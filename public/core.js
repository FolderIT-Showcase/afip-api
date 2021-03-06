var app = angular.module('node-fe', [
  'ngRoute',
  'ngStorage',
  'ngAnimate',
  'ngLodash',
  'ngSanitize',
  'angularMoment',
  'toastr',
  'vcRecaptcha',
  'angular-jwt',
  'darthwade.dwLoading',
  'angularFileUpload',
  'ui.bootstrap',
  'datatables',
  'datatables.bootstrap',
  'datatables.buttons',
  'datatables.columnfilter'
]);

app.service('TEXT_ERRORS', [function () {
  this.ERR_API_CONNECTION = "Error de conexión a la API";
}]);

app.run(['$rootScope', '$http', '$localStorage', '$loading', function ($rootScope, $http, $localStorage, $loading) {
  $loading.setDefaultOptions({
    text: 'Cargando...',
    fps: 60
  });

  if ($localStorage.jwt) {
    $rootScope.loggedIn = true;
    $http.defaults.headers.common.Authorization = $localStorage.jwt;
  } else {
    $rootScope.loggedIn = false;
  }
}]);

app.factory('httpAbortInterceptor', ['$q', '$location', '$localStorage', 'jwtHelper', '$injector', '$rootScope', 'TEXT_ERRORS', function ($q, $location, $localStorage, jwtHelper, $injector, $rootScope, TEXT_ERRORS) {
  var canceller = $q.defer();

  return {
    request: function (config) {
      if (config.url.match('api/') && !config.url.match('api/login') && !config.url.match('api/token') && (!$localStorage.jwt || jwtHelper.isTokenExpired($localStorage.jwt))) {
        config.timeout = 0;
        config.aborted = true;
      }

      return config || $q.when(config);
    },
    responseError: function (rejection) {
      var toastr = $injector.get('toastr');

      if (rejection.aborted) {
        toastr.warning("Su sesión ha expirado. Por favor, reingrese al sistema.");
        canceller.resolve('Session Expired');
        $location.path('/');
        $localStorage.jwt = undefined;
        $localStorage.admin = undefined;
        $rootScope.loggedIn = false;
      } else if (rejection.status === 401) {
        toastr.warning("Su sesión es inválida o ha expirado.");
        if ($localStorage.jwt && $localStorage.username && $localStorage.jwtRefresh && jwtHelper.isTokenExpired($localStorage.jwt) === true) {
          var $http = $injector.get('$http');
          $http.post('/api/token', { username: $localStorage.username, refreshToken: $localStorage.jwtRefresh })
            .then((res) => {
              if (res.data.result === true) {
                toastr.info("Sesión renovada. Por favor, reintente la operación.");
                $localStorage.jwt = res.data.token;
                $localStorage.admin = res.data.admin;

                $rootScope.loggedIn = true;

                $http.defaults.headers.common.Authorization = res.data.token;
                canceller.resolve('Unauthorized');
              } else {
                $localStorage.jwt = undefined;
                $localStorage.admin = undefined;
                $rootScope.loggedIn = false;
                canceller.resolve('Unauthorized');
              }
            }).catch(() => {
              $localStorage.jwt = undefined;
              $localStorage.admin = undefined;
              $rootScope.loggedIn = false;
              canceller.resolve('Unauthorized');
            });
        } else {
          $localStorage.jwt = undefined;
          $localStorage.admin = undefined;
          $rootScope.loggedIn = false;
          $location.path('/');
          canceller.resolve('Unauthorized');
        }
      } else if (rejection.status === 403) {
        toastr.warning("Su usuario no tiene permisos para realizar la operación.");
        canceller.resolve('Forbidden');
      } else {
        let err = TEXT_ERRORS.ERR_API_CONNECTION;

        if (rejection.data && rejection.data.err) {
          err = rejection.data.err;
        }

        if (rejection.data && typeof (rejection.data) === "string") {
          err = rejection.data;
        }

        if (angular.isArray(err)) {
          err.forEach((e) => {
            if (typeof e === 'object') {
              let $htmlError = '';
              let isFirst = true;
              for (const key in e) {
                $htmlError += `${(isFirst === false) ? '<br/>' : ''}${key}: ${e[key]}`;
                isFirst = false;
              }
              toastr.error($htmlError);
            } else {
              toastr.error(e);
            }
          });
        } else {
          toastr.error(err);
        }
      }
      return $q.reject(rejection);
    }
  };
}]);

app.config(($provide, $httpProvider) => {
  $httpProvider.interceptors.push('httpAbortInterceptor');
});

app.controller('MainController', [function () {

}]);

app.controller('NavbarController', ['$scope', '$rootScope', '$localStorage', '$location', 'toastr', function ($scope, $rootScope, $localStorage, $location, toastr) {
  $scope.isCollapsed = true;

  $scope.logout = function () {
    $localStorage.jwt = undefined;
    $localStorage.admin = undefined;
    $location.path('/');
    $rootScope.loggedIn = false;
    toastr.success("Salida del sistema exitosa");
  };
}]);

app.controller('ReportingController', [function () {

}]);

app.controller('DashboardController', ['$scope', '$filter', '$http', 'DTOptionsBuilder', 'DTColumnDefBuilder', '$uibModal', 'lodash', 'moment', 'toastr', '$loading', 'FileUploader', '$localStorage', function ($scope, $filter, $http, DTOptionsBuilder, DTColumnDefBuilder, $uibModal, _, moment, toastr, $loading, FileUploader, $localStorage) {
  var uploader = $scope.uploader = new FileUploader();
  uploader.url = "/api/upload/signer";

  $scope.isAdmin = $localStorage.admin;
  $scope.clients = [];
  $scope.users = [];
  $scope.client = {};
  $scope.CertTipo = [{
    Id: "PROD",
    Desc: "Producción"
  }, {
    Id: "HOMO",
    Desc: "Homologación"
  }];
  $scope.CbteTipo = [];
  $scope.services = [{
    Id: "wsfe",
    Desc: "Facturación Electrónica (WSFE)"
  }, {
    Id: "wsfex",
    Desc: "Facturación Electrónica de Exportación (WSFEX)"
  }];

  const vmCButtons = [{
    text: "Recargar",
    action: function () {
      $scope.getClients();
    }
  }];

  if ($scope.isAdmin) {
    vmCButtons.push({
      text: "Nuevo",
      action: function () {
        $scope.newClient();
      }
    });
  }

  vmCButtons.push({
    extend: 'csvHtml5',
    exportOptions: {
      columns: 'thead th:not(.not-sortable)'
    },
    title: `clientes_${moment().format("YYYYMMDD_HH-mm-ss")}`
  });

  $scope.vmC = {
    dtOptions: DTOptionsBuilder.newOptions()
      .withPaginationType('full_numbers')
      .withBootstrap()
      .withDOM('lfrBtip')
      .withButtons(vmCButtons),
    dtColumnDefs: [
      DTColumnDefBuilder.newColumnDef('not-sortable').notSortable()
    ]
  };

  const vmUButtons = [{
    text: "Recargar",
    action: function () {
      $scope.getUsers();
    }
  }];

  if ($scope.isAdmin) {
    vmUButtons.push({
      text: "Nuevo",
      action: function () {
        $scope.newUser();
      }
    });
  }

  vmUButtons.push({
    extend: 'csvHtml5',
    exportOptions: {
      columns: 'thead th:not(.not-sortable)'
    },
    title: `usuarios_${moment().format("YYYYMMDD_HH-mm-ss")}`
  });

  $scope.vmU = {
    dtOptions: DTOptionsBuilder.newOptions()
      .withPaginationType('full_numbers')
      .withBootstrap()
      .withDOM('lfrBtip')
      .withButtons(vmUButtons),
    dtColumnDefs: [
      DTColumnDefBuilder.newColumnDef('not-sortable').notSortable()
    ]
  };

  $scope.vmT = {
    dtOptions: DTOptionsBuilder.newOptions()
      .withPaginationType('full_numbers')
      .withBootstrap()
      .withOption('aaSorting', [[3, 'desc']])
      .withDOM('lfrBtip')
      .withButtons([{
        text: "Recargar",
        action: function () {
          $scope.getTransactions($scope.client);
        }
      }, {
        extend: 'csvHtml5',
        exportOptions: {
          columns: 'thead th:not(.not-sortable)'
        },
        title: `transacciones_${moment().format("YYYYMMDD_HH-mm-ss")}`
      }])
      .withColumnFilter({
        aoColumns: {
          0: {
            type: 'text'
          },
          1: {
            type: 'text'
          },
          2: {
            type: 'text'
          },
          3: {
            type: 'text'
          },
          4: {
            type: 'number'
          },
          6: {
            type: 'number'
          },
          7: {
            type: 'number'
          },
          8: {
            type: 'text'
          }
        }
      }),
    dtColumnDefs: [
      DTColumnDefBuilder.newColumnDef('not-sortable').notSortable()
    ]
  };

  uploader.onAfterAddingFile = function (fileItem) {
    $loading.start('uploadSigner');
    fileItem.upload();
  };
  uploader.onSuccessItem = function (fileItem, response) {
    if (response.result) {
      $scope.client.signer = response.data;
      $scope.dndSigner = false;
    } else {
      toastr.error(response.err);
    }
  };
  uploader.onErrorItem = function () {
    toastr.error("Ocurrió un error al intentar procesar el certificado. Por favor, intente nuevamente.");
  };
  uploader.onCompleteAll = function () {
    $loading.finish('uploadSigner');
  };

  $scope.toggleSigner = function () {
    $scope.dndSigner = !$scope.dndSigner;
  };

  $scope.getClients = function (next) {
    $loading.start('clients');

    $http.get('/api/admin/getClients')
      .then((res) => {
        $loading.finish('clients');

        if (res.data.result) {
          $scope.clients = res.data.data;
          if (next) next();
        } else {
          $scope.clients = [];
          toastr.error(res.data.err);
        }
      }).catch(() => {
        $scope.clients = [];
        $loading.finish('clients');
      });
  };

  $scope.getUsers = function (next) {
    $loading.start('users');

    $http.get('/api/admin/getUsers')
      .then((res) => {
        $loading.finish('users');

        if (res.data.result) {
          $scope.users = res.data.data;
          if (next) next();
        } else {
          $scope.users = [];
          toastr.error(res.data.err);
        }
      }).catch(() => {
        $scope.users = [];
        $loading.finish('users');
      });
  };

  var reload = function () {
    $scope.getClients(() => {
      $scope.getUsers();
    });
  };

  reload();

  $scope.formatCbteTipo = function (code) {
    for (var i = 0; i < $scope.CbteTipo.length; i++) {
      if (code === $scope.CbteTipo[i].Id) {
        return $scope.CbteTipo[i].Desc;
      }
    }
  };

  $scope.formatService = function (code) {
    for (var i = 0; i < $scope.services.length; i++) {
      if (code === $scope.services[i].Id) {
        return $scope.services[i].Desc;
      }
    }
  };

  $scope.getTransactions = function (client) {
    $loading.start('transactions');

    $http.get(`/api/cbteTipo/${client.code}`).then((res) => {
      if (res.data.result) {
        $scope.CbteTipo = res.data.data;
        return $http.get(`/api/admin/transactions/${client.code}`);
      } else {
        $loading.finish('transactions');
        toastr.error(res.data.err);
      }
    }).then((res) => {
      if (res.data.result) {
        $scope.transactions = res.data.data;

        //Resaltar los datos más importantes
        _.forEach($scope.transactions, (e) => {
          var response = JSON.parse(e.response || "{}");
          var request = JSON.parse(e.request || "{}");
          var cmp = {}, cab = {}, det = {}, detReq = {};

          //WSFE FECAESolicitar
          if (response.FECAESolicitarResult) {
            if (response.FECAESolicitarResult && response.FECAESolicitarResult.FeDetResp && response.FECAESolicitarResult.FeDetResp.FECAEDetResponse) {
              det = response.FECAESolicitarResult.FeDetResp.FECAEDetResponse;
            }
            if (response.FECAESolicitarResult.FeCabResp) {
              cab = response.FECAESolicitarResult.FeCabResp;
            }
            if (request.FeCAEReq && request.FeCAEReq.FeDetReq && request.FeCAEReq.FeDetReq.FECAEDetRequest[0]) {
              detReq = request.FeCAEReq.FeDetReq.FECAEDetRequest[0];
            }

            e.resultado = det.Resultado;
            e.cae = det.CAE;
            e.cbteNro = det.CbteDesde;
            e.importe = detReq.ImpTotal * detReq.MonCotiz;
            e.cbteFca = (det.CbteFch) ? moment(det.CbteFch, "YYYYMMDD").format("DD/MM/YYYY") : (detReq.CbteFch) ? moment(detReq.CbteFch, "YYYYMMDD").format("DD/MM/YYYY") : undefined;
            e.caeVto = (det.CAEFchVto) ? moment(det.CAEFchVto, "YYYYMMDD").format("DD/MM/YYYY") : undefined;
            e.ptoVta = cab.PtoVta;
            e.cbteTipo = cab.CbteTipo;

            if (e.resultado !== 'A') {
              e.resultado = 'R';
            }
          }

          //WSFE FECompUltimoAutorizado
          if (response.FECompUltimoAutorizadoResult) {
            det = response.FECompUltimoAutorizadoResult;

            e.ptoVta = det.PtoVta || request.PtoVta;
            e.cbteTipo = det.CbteTipo || request.CbteTipo;
            e.cbteNro = det.CbteNro;
          }

          //WSFE FECompConsultar
          if (response.FECompConsultarResult) {
            if (response.FECompConsultarResult.ResultGet) {
              det = response.FECompConsultarResult.ResultGet;
            }
            if (request.FeCompConsReq) {
              detReq = request.FeCompConsReq;
            }

            e.resultado = det.Resultado;
            e.ptoVta = det.PtoVta || detReq.PtoVta;
            e.cbteTipo = det.CbteTipo || detReq.CbteTipo;
            e.cae = det.CodAutorizacion;
            e.cbteNro = det.CbteDesde || detReq.CbteNro;
            e.importe = det.ImpTotal;
            e.cbteFca = (det.CbteFch) ? moment(det.CbteFch, "YYYYMMDD").format("DD/MM/YYYY") : undefined;
            e.caeVto = (det.FchVto) ? moment(det.FchVto, "YYYYMMDD").format("DD/MM/YYYY") : undefined;
          }

          //WSFEX FEXAuthorize
          if (response.FEXAuthorizeResult) {
            if (response.FEXAuthorizeResult && response.FEXAuthorizeResult.FEXResultAuth) {
              cab = response.FEXAuthorizeResult.FEXResultAuth;
            }
            if (request.Cmp) {
              cmp = request.Cmp;
            }

            e.ptoVta = cab.Punto_vta || cmp.Punto_vta;
            e.cbteTipo = cab.Cbte_tipo || cmp.Cbte_Tipo;
            e.resultado = cab.Resultado;
            e.cae = cab.Cae;
            e.cbteNro = cab.Cbte_nro || cmp.Cbte_nro;
            e.importe = cmp.Imp_total * cmp.Moneda_ctz;
            e.cbteFca = (cab.Fch_cbte) ? moment(cab.Fch_cbte, "YYYYMMDD").format("DD/MM/YYYY") : (cmp.Fecha_cbte) ? moment(cmp.Fecha_cbte, "YYYYMMDD").format("DD/MM/YYYY") : undefined;
            e.caeVto = (cab.Fch_venc_Cae) ? moment(cab.Fch_venc_Cae, "YYYYMMDD").format("DD/MM/YYYY") : undefined;

            if (e.resultado !== 'A') {
              e.resultado = 'R';
            }
          }

          //Descripción del tipo de comprobante
          if (e.cbteTipo) {
            var cbte = e.cbteDesc = _.find($scope.CbteTipo, (t) => {
              return t.Id === e.cbteTipo;
            });

            if (cbte) {
              e.cbteDesc = cbte.Desc;
            } else {
              e.cbteDesc = "N/A";
            }
          }
        });
      } else {
        toastr.error(res.data.err);
      }
      $loading.finish('transactions');
    }).catch(() => {
      $loading.finish('transactions');
    });
  };

  $scope.viewTransactions = function (client) {
    $scope.client = client;
    $scope.modalTitle = `Transacciones del Cliente: ${client.code}`;
    $scope.transactions = [];

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      size: 'xxl',
      templateUrl: 'views/modals/transactions.html'
    });

    modalInstance.result.then(() => {
    }).catch(() => {
    });

    modalInstance.rendered.then(() => {
      $scope.getTransactions(client);
    });
  };

  $scope.viewDetail = function (transaction) {
    $scope.detailsTitle = "Detalle de Transacción";

    $scope.details = [{
      Id: "Solicitud",
      Desc: JSON.parse(transaction.request || "{}")
    }, {
      Id: "Respuesta",
      Desc: JSON.parse(transaction.response || "{}")
    }];

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      templateUrl: 'views/modals/details.html'
    });

    modalInstance.result.then(() => {
    }).catch(() => {
    });
  };

  $scope.newUser = function () {
    $scope.user = {};
    $scope.modalTitle = "Nuevo Usuario";

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      templateUrl: 'views/modals/user.html'
    });

    modalInstance.result.then((newUser) => {
      $scope.user = angular.copy(newUser);
      $loading.start('users');

      $http.post('/api/admin/newUser', $scope.user)
        .then((res) => {
          $loading.finish('users');

          if (res.data.result) {
            $scope.user = res.data.data;
            $scope.users.push($scope.user);
            toastr.success("Usuario agregado con éxito");
          } else {
            toastr.error(res.data.err);
          }
        }).catch(() => {
          $loading.finish('users');
        });
    }).catch(() => {
      toastr.info("Ingreso de usuario cancelado");
    });
  };

  $scope.newClient = function () {
    $scope.dndSigner = true;
    $scope.client = {};
    $scope.modalTitle = "Nuevo Cliente";

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      size: 'lg',
      templateUrl: 'views/modals/client.html'
    });

    modalInstance.result.then((newClient) => {
      $scope.client = angular.copy(newClient);
      $loading.start('clients');

      $http.post('/api/admin/newClient', $scope.client)
        .then((res) => {
          $loading.finish('clients');

          if (res.data.result) {
            $scope.client = res.data.data;
            $scope.clients.push($scope.client);
            toastr.success("Cliente agregado con éxito");
          } else {
            toastr.error(res.data.err);
          }
        }).catch(() => {
          $loading.finish('clients');
        });
    }).catch(() => {
      toastr.info("Ingreso de cliente cancelado");
    });
  };

  $scope.cloneClient = function (client) {
    $loading.start('clients');
    $scope.client = angular.copy(client);
    $scope.client.code += "-COPY";
    $scope.client._id = undefined;

    $http.post('/api/admin/newClient', $scope.client)
      .then((res) => {
        $loading.finish('clients');

        if (res.data.result) {
          $scope.client = res.data.data;
          $scope.clients.push($scope.client);
          toastr.success("Cliente clonado con éxito");
        } else {
          toastr.error(res.data.err);
        }
      }).catch(() => {
        $loading.finish('clients');
      });
  };

  $scope.editUser = function (user) {
    $scope.user = angular.copy(user);
    $scope.modalTitle = `Editar Usuario: ${user.name}`;

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      templateUrl: 'views/modals/user.html'
    });

    modalInstance.result.then((editedUser) => {
      $scope.user = angular.copy(editedUser);
      $loading.start('users');

      $http.post('/api/admin/editUser', $scope.user)
        .then((res) => {
          $loading.finish('users');

          if (res.data.result) {
            $scope.user = res.data.data;
            var i = _.findIndex($scope.users, { _id: $scope.user._id });
            if (i >= 0) $scope.users[i] = angular.copy($scope.user);
            toastr.success("Usuario editado con éxito");
          } else {
            toastr.error(res.data.err);
          }
        }).catch(() => {
          $loading.finish('users');
        });
    }).catch(() => {
      toastr.info("Edición de usuario cancelada");
    });
  };

  $scope.genRSA = function (client) {
    $scope.modalTitle = "Confirme la generación del certificado";
    $scope.modalBody = "Esta acción eliminará el certificado actual y regenerará la <strong>Key</strong> y <strong>CSR</strong> del cliente.";

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      templateUrl: 'views/modals/confirm.html'
    });

    modalInstance.result.then(() => {
      $loading.start('clients');

      $http.post('/api/genRSA', client)
        .then((res) => {
          $loading.finish('clients');

          if (res.data.result) {
            client = res.data.data;
            var i = _.findIndex($scope.clients, { _id: client._id });
            if (i >= 0) $scope.clients[i] = angular.copy(client);
            toastr.success("Solicitud de certificado generada con éxito.");
            toastr.info("Por favor, recuerde regenerar los Tickets de Acceso a los servicios pertinentes.");
            $scope.editClient(client);
          } else {
            toastr.error(res.data.err);
          }
        }).catch(() => {
          $loading.finish('clients');
        });
    }).catch(() => {
      //
    });
  };

  $scope.editClient = function (client) {
    $scope.dndSigner = false;
    $scope.client = angular.copy(client);
    $scope.modalTitle = `Editar Cliente: ${client.name}`;

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      size: 'lg',
      templateUrl: 'views/modals/client.html'
    });

    modalInstance.result.then((editedClient) => {
      $scope.client = angular.copy(editedClient);
      $loading.start('clients');

      $http.post('/api/admin/editClient', $scope.client)
        .then((res) => {
          $loading.finish('clients');

          if (res.data.result) {
            $scope.client = res.data.data;
            var i = _.findIndex($scope.clients, { _id: $scope.client._id });
            if (i >= 0) $scope.clients[i] = angular.copy($scope.client);
            toastr.success("Cliente editado con éxito");
          } else {
            toastr.error(res.data.err);
          }
        }).catch(() => {
          $loading.finish('clients');
        });
    }).catch(() => {
      toastr.info("Edición de cliente cancelada");
    });
  };

  $scope.saveCSR = function (client) {
    $scope.fileCSR = client.csr;
    var blob = new Blob([$scope.fileCSR], { type: "text/plain;charset=utf-8;" });
    var downloadLink = angular.element('<a></a>');
    downloadLink.attr('href', window.URL.createObjectURL(blob));
    downloadLink.attr('download', `${(client.code ? `${client.code}_` : '') + moment().format("YYYY-MM-DD_HH-mm")}.csr`);
    downloadLink[0].click();
  };

  $scope.resetPassword = function (user) {
    $scope.user = angular.copy(user);
    $scope.modalTitle = `Restablecer Contraseña: ${user.name}`;

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      templateUrl: 'views/modals/resetPassword.html'
    });

    modalInstance.result.then((editedUser) => {
      $scope.user.password = editedUser.newPassword;
      $loading.start('users');

      $http.post('/api/admin/resetPassword', $scope.user)
        .then((res) => {
          $loading.finish('users');

          if (res.data.result) {
            $scope.user = res.data.data;
            var i = _.findIndex($scope.users, { _id: $scope.user._id });
            if (i >= 0) $scope.users[i] = angular.copy($scope.user);
            toastr.success("Contraseña restablecida con éxito");
          } else {
            toastr.error(res.data.err);
          }
        }).catch(() => {
          $loading.finish('users');
        });
    }).catch(() => {
      toastr.info("Restablecimiento de contraseña cancelado");
    });
  };

  $scope.userPermissions = function (user) {
    $scope.user = angular.copy(user);
    $scope.modalTitle = `Permisos de Usuario: ${user.name}`;

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      templateUrl: 'views/modals/userPermissions.html',
      controller: 'UserPermissionsController',
      size: 'lg'
    });

    modalInstance.result.then(() => {
    }).catch(() => {
    });
  };

  $scope.removeClient = function (client) {
    $scope.modalTitle = `Confirme la eliminación del cliente: <strong>${client.code}</strong>`;
    $scope.modalBody = "";

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      templateUrl: 'views/modals/confirm.html'
    });

    modalInstance.result.then(() => {
      $loading.start('clients');

      $http.post('/api/admin/removeClient', client)
        .then((res) => {
          $loading.finish('clients');

          if (res.data.result) {
            var client = res.data.data;
            var i = _.findIndex($scope.clients, { _id: client._id });
            if (i >= 0) $scope.clients.splice(i, 1);
            toastr.success("Cliente removido con éxito");
          } else {
            toastr.error(res.data.err);
          }
        }).catch(() => {
          $loading.finish('clients');
        });
    }).catch(() => {
      //
    });
  };

  $scope.removeUser = function (user) {
    $scope.modalTitle = `Confirme la eliminación del usuario: <strong>${user.username}</strong>`;
    $scope.modalBody = "";

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      templateUrl: 'views/modals/confirm.html'
    });

    modalInstance.result.then(() => {
      $loading.start('users');

      $http.post('/api/admin/removeUser', user)
        .then((res) => {
          $loading.finish('users');

          if (res.data.result) {
            var user = res.data.data;
            var i = _.findIndex($scope.users, { _id: user._id });
            if (i >= 0) $scope.users.splice(i, 1);
            toastr.success("Usuario removido con éxito");
          } else {
            toastr.error(res.data.err);
          }
        }).catch(() => {
          $loading.finish('users');
        });
    }).catch(() => {
      //
    });
  };

  $scope.regenTokens = function (client) {
    $scope.credentials = {};
    $scope.formData = {
      code: client.code
    };
    $scope.modalTitle = `Regenerar Tickets de Acceso: ${client.code}`;
    $scope.responseCollapsed = true;
    $scope.response = undefined;

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      templateUrl: 'views/modals/regenTokens.html'
    });

    modalInstance.result.then(() => {
    }).catch(() => {
    });

    modalInstance.rendered.then(() => {
    });
  };

  $scope.regenTokensGet = function (formData) {
    $loading.start('regenTokens');

    $http.get(`/api/${formData.code}/${formData.service}/refresh/token`).then((res) => {
      $loading.finish('regenTokens');

      if (res.data.result) {
        $scope.credentials = {
          sign: res.data.data.credentials.sign,
          token: res.data.data.credentials.token,
          expiration: moment(res.data.data.until).format('DD/MM/YYYY HH:mm')
        };

        $scope.responseCollapsed = false;
      } else {
        $scope.responseCollapsed = true;
        $scope.credentials = {};
        $scope.response = undefined;
        toastr.error(res.data.err);
      }
    }).catch(() => {
      $scope.responseCollapsed = true;
      $scope.credentials = {};
      $scope.response = undefined;
      $loading.finish('regenTokens');
    });
  };

  $scope.lastCbte = function (client) {
    $scope.formData = {
      code: client.code,
      type: client.type
    };
    $scope.modalTitle = `Ver Último Comprobante: ${client.code}`;
    $scope.responseCollapsed = true;
    $scope.response = undefined;

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      templateUrl: 'views/modals/lastCbte.html'
    });

    modalInstance.result.then(() => {
    }).catch(() => {
    });

    modalInstance.rendered.then(() => {
      $loading.start('lastCbte');
      $http.get(`/api/cbteTipo/${client.code}`).then((res) => {
        $loading.finish('lastCbte');
        if (res.data.result) {
          $scope.CbteTipo = res.data.data;
        } else {
          toastr.error(res.data.err);
        }
      }).catch(() => {
        modalInstance.dismiss();
        $loading.finish('lastCbte');
      });
    });
  };

  $scope.lastCbteGet = function (formData) {
    $loading.start('lastCbte');

    $http.post('/api/lastCbte', formData).then((res) => {
      $loading.finish('lastCbte');

      if (res.data.result) {
        $scope.response = `Punto de Venta: <strong>${formData.PtoVta}</strong><br/>`;
        $scope.response += `Tipo de Comprobante: <strong>${_.find($scope.CbteTipo, { Id: formData.CbteTipo }).Desc}</strong><br/>`;
        $scope.response += `Nº Último Comprobante: <strong>${res.data.data}</strong>`;
        $scope.responseCollapsed = false;
      } else {
        $scope.responseCollapsed = true;
        $scope.response = undefined;
        var errs = "";

        if (angular.isArray(res.data.err)) {
          _.forEach(res.data.err, (e) => {
            errs += `<p><strong>Error ${e.Code}</strong><br/>${e.Msg}</p>`;
          });
        } else {
          errs = res.data.err;
        }

        toastr.error(errs);
      }
    }).catch(() => {
      $scope.responseCollapsed = true;
      $scope.response = undefined;
      $loading.finish('lastCbte');
    });
  };

  $scope.compConsultar = function (client) {
    $scope.formData = {
      code: client.code,
      type: client.type
    };
    $scope.modalTitle = `Consultar Comprobante: ${client.code}`;
    $scope.responseCollapsed = true;
    $scope.response = undefined;

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      templateUrl: 'views/modals/compConsultar.html'
    });

    modalInstance.result.then(() => {
    }).catch(() => {
    });

    modalInstance.rendered.then(() => {
      $loading.start('compConsultar');
      $http.get(`/api/cbteTipo/${client.code}`).then((res) => {
        $loading.finish('compConsultar');
        if (res.data.result) {
          $scope.CbteTipo = res.data.data;
        } else {
          toastr.error(res.data.err);
        }
      }).catch(() => {
        modalInstance.dismiss();
        $loading.finish('compConsultar');
      });
    });
  };

  $scope.compConsultarGet = function (formData) {
    $loading.start('compConsultar');

    $http.post('/api/compConsultar', formData).then((res) => {
      $loading.finish('compConsultar');

      if (res.data.result) {
        $scope.response = res.data.data;
        $scope.responseCollapsed = false;
      } else {
        $scope.responseCollapsed = true;
        $scope.response = undefined;
        var errs = "";

        if (angular.isArray(res.data.err)) {
          _.forEach(res.data.err, (e) => {
            errs += `<p><strong>Error ${e.Code}</strong><br/>${e.Msg}</p>`;
          });
        } else {
          errs = res.data.err;
        }

        toastr.error(errs);
      }
    }).catch(() => {
      $scope.responseCollapsed = true;
      $scope.response = undefined;
      $loading.finish('compConsultar');
    });
  };
}]);

app.controller('UserPermissionsController', ['$scope', '$filter', '$http', 'DTOptionsBuilder', 'DTColumnDefBuilder', '$uibModal', 'lodash', 'moment', 'toastr', '$loading', function ($scope, $filter, $http, DTOptionsBuilder, DTColumnDefBuilder, $uibModal, _, moment, toastr, $loading) {
  $scope.permissions = [];
  $scope.clients = angular.copy($scope.$parent.clients);
  $scope.user = angular.copy($scope.$parent.user);

  $scope.vmP = {
    dtOptions: DTOptionsBuilder.newOptions()
      .withPaginationType('full_numbers')
      .withBootstrap()
      .withDOM('lfrBtip')
      .withButtons([{
        text: "Recargar",
        action: function () {
          $scope.getPermissions($scope.user);
        }
      }, {
        text: "Nuevo",
        action: function () {
          $scope.newPermit($scope.user);
        }
      }, {
        extend: 'csvHtml5',
        exportOptions: {
          columns: 'thead th:not(.not-sortable)'
        },
        title: `permisos_${$scope.user.username}_${moment().format("YYYYMMDD_HH-mm-ss")}`
      }]),
    dtColumnDefs: [
      DTColumnDefBuilder.newColumnDef('not-sortable').notSortable()
    ]
  };

  $scope.formatClient = function (code) {
    for (var i = 0; i < $scope.clients.length; i++) {
      if (code === $scope.clients[i].code) {
        return $scope.clients[i].name;
      }
    }
  };

  $scope.newPermit = function (permit) {
    $scope.permit = {
      username: $scope.user.username,
      code: permit.code,
      active: permit.active
    };
    $scope.modalTitle = "Nuevo Permiso";

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      templateUrl: 'views/modals/permit.html'
    });

    modalInstance.result.then((newPermit) => {
      $scope.permit = angular.copy(newPermit);
      $loading.start('permissions');

      $http.post('/api/admin/newPermit', $scope.permit)
        .then((res) => {
          $loading.finish('permissions');

          if (res.data.result) {
            $scope.permit = res.data.data;
            $scope.permissions.push($scope.permit);
            toastr.success("Permiso agregado con éxito");
          } else {
            toastr.error(res.data.err);
          }
        }).catch(() => {
          $loading.finish('permissions');
        });
    }).catch(() => {
      toastr.info("Ingreso de permiso cancelado");
    });
  };

  $scope.editPermit = function (permit) {
    $scope.permit = angular.copy(permit);
    $scope.modalTitle = `Editar Permiso: ${permit.code}`;

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      templateUrl: 'views/modals/permit.html'
    });

    modalInstance.result.then((editedPermit) => {
      $scope.permit = angular.copy(editedPermit);
      $loading.start('permissions');

      $http.post('/api/admin/editPermit', $scope.permit)
        .then((res) => {
          $loading.finish('permissions');

          if (res.data.result) {
            $scope.permit = res.data.data;
            var i = _.findIndex($scope.permissions, { _id: $scope.permit._id });
            if (i >= 0) $scope.permissions[i] = angular.copy($scope.permit);
            toastr.success("Permiso editado con éxito");
          } else {
            toastr.error(res.data.err);
          }
        }).catch(() => {
          $loading.finish('permissions');
        });
    }).catch(() => {
      toastr.info("Edición de permiso cancelada");
    });
  };

  $scope.removePermit = function (permit) {
    $scope.modalTitle = "Confirme la eliminación del permiso";
    $scope.modalBody = `Usuario: <strong>${permit.username}</strong><br/>`;
    $scope.modalBody += `Cliente: <strong>${permit.code}</strong><br/>`;

    var modalInstance = $uibModal.open({
      backdrop: 'static',
      scope: $scope,
      templateUrl: 'views/modals/confirm.html'
    });

    modalInstance.result.then(() => {
      $loading.start('permissions');

      $http.post('/api/admin/removePermit', permit)
        .then((res) => {
          $loading.finish('permissions');

          if (res.data.result) {
            var permit = res.data.data;
            var i = _.findIndex($scope.permissions, { _id: permit._id });
            if (i >= 0) $scope.permissions.splice(i, 1);
            toastr.success("Permiso removido con éxito");
          } else {
            toastr.error(res.data.err);
          }
        }).catch(() => {
          $loading.finish('permissions');
        });
    }).catch(() => {
      //
    });
  };

  $scope.getPermissions = function (user) {
    $loading.start('permissions');

    $http.get(`/api/admin/permissions/${user.username}`)
      .then((res) => {
        $loading.finish('permissions');

        if (res.data.result) {
          $scope.permissions = res.data.data;
        } else {
          toastr.error(res.data.err);
        }
      }).catch(() => {
        $loading.finish('permissions');
      });
  };

  $scope.getPermissions($scope.user);
}]);

app.controller('LoginController', ['$scope', '$rootScope', '$http', '$location', '$localStorage', 'toastr', '$loading', 'vcRecaptchaService', function ($scope, $rootScope, $http, $location, $localStorage, toastr, $loading, vcRecaptchaService) {
  if ($localStorage.jwt) {
    $location.path('dashboard');
  }

  $scope.response = null;
  $scope.widgetId = null;
  $scope.formData = {};
  $scope.recaptcha = {
    key: "6Les3h8UAAAAABnMNny1yzwwf06QWs-hQWEYHH_D"
  };

  $scope.setResponse = function (response) {
    $scope.response = response;
  };

  $scope.setWidgetId = function (widgetId) {
    $scope.widgetId = widgetId;
  };

  $scope.cbExpiration = function () {
    vcRecaptchaService.reload($scope.widgetId);
    $scope.response = null;
  };

  $scope.login = function () {
    $loading.start('login');

    $http.post('/api/login', $scope.formData)
      .then((res) => {
        $loading.finish('login');

        if (res.data.result) {
          $localStorage.username = $scope.formData.username;
          $localStorage.jwt = res.data.token;
          $localStorage.admin = res.data.admin;

          if ($scope.formData.rememberMe === true) {
            $localStorage.jwtRefresh = res.data.refreshToken;
          }

          $rootScope.loggedIn = true;

          $http.defaults.headers.common.Authorization = res.data.token;

          toastr.success("¡Bienvenido al nuevo sistema de Facturación Electrónica!");
          $location.path('dashboard');
        } else {
          toastr.error(res.data.err);
          //vcRecaptchaService.reload($scope.widgetId);
        }
      }).catch(() => {
        $loading.finish('login');
        vcRecaptchaService.reload($scope.widgetId);
      });
  };
}]);

app.directive("compareTo", [function () {
  return {
    require: "ngModel",
    scope: {
      otherModelValue: "=compareTo"
    },
    link: function (scope, element, attributes, ngModel) {

      ngModel.$validators.compareTo = function (modelValue) {
        return modelValue === scope.otherModelValue;
      };

      scope.$watch("otherModelValue", () => {
        ngModel.$validate();
      });
    }
  };
}]);

app.config(['$routeProvider', '$locationProvider', function ($routeProvider, $locationProvider) {
  $routeProvider
    .when('/', {
      templateUrl: 'views/login.html',
      controller: 'LoginController'
    })
    .when('/dashboard', {
      templateUrl: 'views/dashboard.html',
      controller: 'DashboardController'
    })
    .when('/reportes', {
      templateUrl: 'views/reportes.html',
      controller: 'ReportingController'
    })
    .otherwise({
      redirectTo: '/'
    });

  $locationProvider.hashPrefix('').html5Mode(true);
}]);

app.config(['toastrConfig', function (toastrConfig) {
  angular.extend(toastrConfig, {
    allowHtml: true,
    closeButton: false,
    closeHtml: '<button>&times;</button>',
    extendedTimeOut: 1000,
    iconClasses: {
      error: 'toast-error',
      info: 'toast-info',
      success: 'toast-success',
      warning: 'toast-warning'
    },
    messageClass: 'toast-message',
    onHidden: null,
    onShown: null,
    onTap: null,
    progressBar: true,
    tapToDismiss: true,
    templates: {
      toast: 'directives/toast/toast.html',
      progressbar: 'directives/progressbar/progressbar.html'
    },
    timeOut: 5000,
    titleClass: 'toast-title',
    toastClass: 'toast'
  });
}]);
