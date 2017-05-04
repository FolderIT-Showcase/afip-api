// public/core.js
var app = angular.module('node-fe', [
    'ngRoute',
    'ngStorage',
    'ngAnimate',
    'ngLodash',
    'ngSanitize',
    'angularMoment',
    'toastr',
    'darthwade.dwLoading',
    'ui.bootstrap',
    'datatables',
    'datatables.bootstrap',
    'datatables.buttons'
]);

app.service('TEXT_ERRORS', function() {
    this.ERR_API_CONNECTION = "Error de conexión a la API";
});

app.run(['$rootScope', '$http', '$localStorage', '$loading', function($rootScope, $http, $localStorage, $loading) {
    $loading.setDefaultOptions({
        text: 'Cargando...',
        fps: 60
    });

    if ($localStorage.currentUser) {
        $rootScope.loggedIn = true;
        $http.defaults.headers.common.Authorization = $localStorage.currentUser.token;
    } else {
        $rootScope.loggedIn = false;
    }
}]);

app.controller('MainController', ['$scope', function($scope) {    

}]);

app.controller('NavbarController', ['$scope', '$rootScope', '$localStorage', '$location', 'toastr', function($scope, $rootScope, $localStorage, $location, toastr) {
    $scope.isCollapsed = true;

    $scope.logout = function() {
        $localStorage.currentUser = undefined;
        $location.path('/');
        $rootScope.loggedIn = false;
        toastr.success("Salida del sistema exitosa");
    }
}]);

app.controller('ReportingController', ['$scope', function($scope) {

}]);

app.controller('DashboardController', ['$scope', '$filter', '$http', 'DTOptionsBuilder', 'DTColumnDefBuilder', '$uibModal', 'lodash', 'moment', 'toastr', '$loading', 'TEXT_ERRORS', function($scope, $filter, $http, DTOptionsBuilder, DTColumnDefBuilder, $uibModal, _, moment, toastr, $loading, TEXT_ERRORS) {
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
    $scope.CbteTipo = [
        {
            "Id": 1,
            "Desc": "Factura A"
        },
        {
            "Id": 2,
            "Desc": "Nota de Débito A"
        },
        {
            "Id": 3,
            "Desc": "Nota de Crédito A"
        },
        {
            "Id": 6,
            "Desc": "Factura B"
        },
        {
            "Id": 7,
            "Desc": "Nota de Débito B"
        },
        {
            "Id": 8,
            "Desc": "Nota de Crédito B"
        },
        {
            "Id": 4,
            "Desc": "Recibos A"
        },
        {
            "Id": 5,
            "Desc": "Notas de Venta al contado A"
        },
        {
            "Id": 9,
            "Desc": "Recibos B"
        },
        {
            "Id": 10,
            "Desc": "Notas de Venta al contado B"
        },
        {
            "Id": 63,
            "Desc": "Liquidacion A"
        },
        {
            "Id": 64,
            "Desc": "Liquidacion B"
        },
        {
            "Id": 34,
            "Desc": "Cbtes. A del Anexo I, Apartado A,inc.f),R.G.Nro. 1415"
        },
        {
            "Id": 35,
            "Desc": "Cbtes. B del Anexo I,Apartado A,inc. f),R.G. Nro. 1415"
        },
        {
            "Id": 39,
            "Desc": "Otros comprobantes A que cumplan con R.G.Nro. 1415"
        },
        {
            "Id": 40,
            "Desc": "Otros comprobantes B que cumplan con R.G.Nro. 1415"
        },
        {
            "Id": 60,
            "Desc": "Cta de Vta y Liquido prod. A"
        },
        {
            "Id": 61,
            "Desc": "Cta de Vta y Liquido prod. B"
        },
        {
            "Id": 11,
            "Desc": "Factura C"
        },
        {
            "Id": 12,
            "Desc": "Nota de Débito C"
        },
        {
            "Id": 13,
            "Desc": "Nota de Crédito C"
        },
        {
            "Id": 15,
            "Desc": "Recibo C"
        },
        {
            "Id": 49,
            "Desc": "Comprobante de Compra de Bienes Usados a Consumidor Final"
        },
        {
            "Id": 51,
            "Desc": "Factura M"
        },
        {
            "Id": 52,
            "Desc": "Nota de Débito M"
        },
        {
            "Id": 53,
            "Desc": "Nota de Crédito M"
        },
        {
            "Id": 54,
            "Desc": "Recibo M"
        }
    ];

    $scope.vmC = {
        dtOptions: DTOptionsBuilder.newOptions()
        .withPaginationType('full_numbers')
        .withBootstrap()
        .withDOM('lfrBtip')
        .withButtons([{
            text: "Recargar",
            action: function() {
                $scope.getClients();
            }
        }, {
            text: "Nuevo",
            action: function() {
                $scope.newClient();
            }
        }, {
            extend: 'csvHtml5',
            exportOptions: {
                columns: 'thead th:not(.not-sortable)'
            },
            title: 'clientes_' + moment().format("YYYYMMDD_HH-mm-ss")
        }]),
        dtColumnDefs: [
            DTColumnDefBuilder.newColumnDef('not-sortable').notSortable()
        ]
    };

    $scope.vmU = {
        dtOptions: DTOptionsBuilder.newOptions()
        .withPaginationType('full_numbers')
        .withBootstrap()
        .withDOM('lfrBtip')
        .withButtons([{
            text: "Recargar",
            action: function() {
                $scope.getUsers();
            }
        }, {
            text: "Nuevo",
            action: function() {
                $scope.newUser();
            }
        }, {
            extend: 'csvHtml5',
            exportOptions: {
                columns: 'thead th:not(.not-sortable)'
            },
            title: 'usuarios_' + moment().format("YYYYMMDD_HH-mm-ss")
        }]),
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
            action: function() {
                $scope.getTransactions($scope.client);
            }
        }, {
            extend: 'csvHtml5',
            exportOptions: {
                columns: 'thead th:not(.not-sortable)'
            },
            title: 'transacciones_' + moment().format("YYYYMMDD_HH-mm-ss")
        }]),
        dtColumnDefs: [
            DTColumnDefBuilder.newColumnDef('not-sortable').notSortable()
        ]
    };

    $scope.getClients = function(callback) {
        $loading.start('clients');

        $http.get('/api/getClients')
            .then(function(res) {
            $loading.finish('clients');

            if(res.data.result) {
                $scope.clients = res.data.data;
            } else {
                toastr.error(res.data.err);
            }

            if(callback) callback();
        }, function(res) {
            $loading.finish('clients');
            toastr.error(res.data || TEXT_ERRORS.ERR_API_CONNECTION);

            if(callback) callback();
        });
    }

    $scope.getUsers = function(callback) {
        $loading.start('users');

        $http.get('/api/getUsers')
            .then(function(res) {
            $loading.finish('users');

            if(res.data.result) {
                $scope.users = res.data.data;
            } else {
                toastr.error(res.data.err);
            }

            if(callback) callback();
        }, function(res) {
            $loading.finish('users');
            toastr.error(res.data || TEXT_ERRORS.ERR_API_CONNECTION);

            if(callback) callback();
        });
    }

    var reload = function() {
        $scope.getClients(function(){
            $scope.getUsers();
        });
    }

    reload();

    $scope.getTransactions = function(client, callback) {
        $loading.start('transactions');

        $http.get('/api/transactions/' + client.code)
            .then(function(res) {
            $loading.finish('transactions');

            if(res.data.result) {
                $scope.transactions = res.data.data;

                //Resaltar los datos más importantes
                _.forEach($scope.transactions, function(e) {
                    var response = JSON.parse(e.response || {});
                    //WSFE
                    if (response.FECAESolicitarResult && response.FECAESolicitarResult.FeDetResp && response.FECAESolicitarResult.FeDetResp.FECAEDetResponse) {
                        var det = response.FECAESolicitarResult.FeDetResp.FECAEDetResponse;
                        e.resultado = det.Resultado;
                        e.cae = det.CAE;
                        e.cbteNro = det.CbteDesde;
                    }
                    if (response.FECAESolicitarResult && response.FECAESolicitarResult.FeCabResp) {
                        var cab = response.FECAESolicitarResult.FeCabResp;
                        e.ptoVta = cab.PtoVta;
                        e.cbteTipo = cab.CbteTipo;
                    }
                    
                    //WSFEX
                    if (response.FEXAuthorizeResult && response.FEXAuthorizeResult.FEXResultAuth) {
                        var cab = response.FEXAuthorizeResult.FEXResultAuth;
                        e.ptoVta = cab.Punto_vta;
                        e.cbteTipo = cab.Cbte_tipo;
                        e.resultado = cab.Resultado;
                        e.cae = cab.Cae;
                        e.cbteNro = cab.Cbte_nro;
                    }
                });

                $scope.modalTitle = "Transacciones del Cliente: " + client.code;
            } else {
                toastr.error(res.data.err);
            }

            if (callback) callback();
        }, function(res) {
            $loading.finish('transactions');
            toastr.error(res.data || TEXT_ERRORS.ERR_API_CONNECTION);

            if (callback) callback();
        });
    }

    $scope.viewTransactions = function(client) {
        $scope.client = client;

        $scope.getTransactions(client, function() {
            var modalInstance = $uibModal.open({
                backdrop: 'static',
                scope: $scope,
                size: 'lg',
                templateUrl: 'modals/transactions.html'
            });
        });
    }

    $scope.viewDetail = function(transaction) {
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
            templateUrl: 'modals/details.html'
        });
    }

    $scope.newUser = function() {
        $scope.user = {};
        $scope.modalTitle = "Nuevo Usuario"

        var modalInstance = $uibModal.open({
            backdrop: 'static',
            scope: $scope,
            templateUrl: 'modals/user.html'
        });

        modalInstance.result.then(function (newUser) {
            $scope.user = angular.copy(newUser);
            $loading.start('users');

            $http.post('/api/newUser', $scope.user)
                .then(function(res) {
                $loading.finish('users');

                if (res.data.result) {
                    $scope.user = res.data.data;
                    $scope.users.push($scope.user);
                    toastr.success("Usuario agregado con éxito");
                } else {
                    toastr.error(res.data.err);
                }
            }, function(res) {
                $loading.finish('users');
                toastr.error(res.data || TEXT_ERRORS.ERR_API_CONNECTION);
            });
        }, function () {
            toastr.info("Ingreso de usuario cancelado");
        });
    };

    $scope.newClient = function() {
        $scope.client = {};
        $scope.modalTitle = "Nuevo Cliente"

        var modalInstance = $uibModal.open({
            backdrop: 'static',
            scope: $scope,
            size: 'lg',
            templateUrl: 'modals/client.html'
        });

        modalInstance.result.then(function (newClient) {
            $scope.client = angular.copy(newClient);
            $loading.start('clients');

            $http.post('/api/newClient', $scope.client)
                .then(function(res) {
                $loading.finish('clients');

                if (res.data.result) {
                    $scope.client = res.data.data;
                    $scope.clients.push($scope.client);
                    toastr.success("Cliente agregado con éxito");
                } else {
                    toastr.error(res.data.err);
                }
            }, function(res) {
                $loading.finish('clients');
                toastr.error(res.data || TEXT_ERRORS.ERR_API_CONNECTION);
            });
        }, function () {
            toastr.info("Ingreso de cliente cancelado");
        });
    };

    $scope.cloneClient = function(client) {
        $loading.start('clients');
        $scope.client = angular.copy(client);
        $scope.client.code += "-COPY";
        $scope.client._id = undefined;

        $http.post('/api/newClient', $scope.client)
            .then(function(res) {
            $loading.finish('clients');

            if (res.data.result) {
                $scope.client = res.data.data;
                $scope.clients.push($scope.client);
                toastr.success("Cliente clonado con éxito");
            } else {
                toastr.error(res.data.err);
            }
        }, function(res) {
            $loading.finish('clients');
            toastr.error(res.data || TEXT_ERRORS.ERR_API_CONNECTION);
        });
    }

    $scope.editClient = function(client) {
        $scope.client = angular.copy(client);
        $scope.modalTitle = "Editar Cliente: " + client.name

        var modalInstance = $uibModal.open({
            backdrop: 'static',
            scope: $scope,
            size: 'lg',
            templateUrl: 'modals/client.html'
        });

        modalInstance.result.then(function (editedClient) {
            $scope.client = angular.copy(editedClient);
            $loading.start('clients');

            $http.post('/api/editClient', $scope.client)
                .then(function(res) {
                $loading.finish('clients');

                if (res.data.result) {
                    $scope.client = res.data.data;
                    var i = _.findIndex($scope.clients, { _id: $scope.client._id });
                    if(i >= 0) $scope.clients[i] = angular.copy($scope.client);
                    toastr.success("Cliente editado con éxito");
                } else {
                    toastr.error(res.data.err);
                }
            }, function(res) {
                $loading.finish('clients');
                toastr.error(res.data || TEXT_ERRORS.ERR_API_CONNECTION);
            })
        }, function () {
            toastr.info("Edición de cliente cancelada");
        });
    };
    
    $scope.resetPassword = function(user) {
        $scope.user = angular.copy(user);
        $scope.modalTitle = "Restablecer Contraseña: " + user.name

        var modalInstance = $uibModal.open({
            backdrop: 'static',
            scope: $scope,
            templateUrl: 'modals/resetPassword.html'
        });

        modalInstance.result.then(function (editedUser) {
            $scope.user.password = editedUser.newPassword;
            $loading.start('users');

            $http.post('/api/resetPassword', $scope.user)
                .then(function(res) {
                $loading.finish('users');

                if (res.data.result) {
                    $scope.user = res.data.data;
                    var i = _.findIndex($scope.users, { _id: $scope.user._id });
                    if(i >= 0) $scope.users[i] = angular.copy($scope.user);
                    toastr.success("Contraseña restablecida con éxito");
                } else {
                    toastr.error(res.data.err);
                }
            }, function(res) {
                $loading.finish('users');
                toastr.error(res.data || TEXT_ERRORS.ERR_API_CONNECTION);
            });
        }, function () {
            toastr.info("Restablecimiento de contraseña cancelado");
        });
    };

    $scope.removeClient = function(client) {
        var modalInstance = $uibModal.open({
            backdrop: 'static',
            scope: $scope,
            templateUrl: 'modals/confirm.html'
        });

        modalInstance.result.then(function () {
            $loading.start('clients');

            $http.post('/api/removeClient', client)
                .then(function(res) {
                $loading.finish('clients');

                if (res.data.result) {
                    var client = res.data.data;
                    var i = _.findIndex($scope.clients, { _id: client._id });
                    if(i >= 0) $scope.clients.splice(i,1);
                    toastr.success("Cliente removido con éxito");
                } else {
                    toastr.error(res.data.err);
                }
            }, function(res) {
                $loading.finish('clients');
                toastr.error(res.data || TEXT_ERRORS.ERR_API_CONNECTION);
            });
        }, function () {
            //
        });
    }

    $scope.removeUser = function(user) {
        var modalInstance = $uibModal.open({
            backdrop: 'static',
            scope: $scope,
            templateUrl: 'modals/confirm.html'
        });

        modalInstance.result.then(function () {
            $loading.start('users');

            $http.post('/api/removeUser', user)
                .then(function(res) {
                $loading.finish('users');

                if (res.data.result) {
                    var user = res.data.data;
                    var i = _.findIndex($scope.users, { _id: user._id });
                    if(i >= 0) $scope.users.splice(i,1);
                    toastr.success("Usuario removido con éxito");
                } else {
                    toastr.error(res.data.err);
                }
            }, function(res) {
                $loading.finish('users');
                toastr.error(res.data || TEXT_ERRORS.ERR_API_CONNECTION);
            });
        }, function () {
            //
        });
    }

    $scope.lastCbte = function(client) {
        $scope.formData = {
            code: client.code,
            type: client.type
        };
        $scope.modalTitle = "Consultar Último Comprobante: " + client.code;
        $scope.responseCollapsed = true;
        $scope.response = undefined;

        var modalInstance = $uibModal.open({
            backdrop: 'static',
            scope: $scope,
            templateUrl: 'modals/lastCbte.html'
        });
    }

    $scope.lastCbteGet = function(formData) {
        $loading.start('lastCbte');

        $http.post('/api/lastCbte', formData)
            .then(function(res) {
            $loading.finish('lastCbte');

            if (res.data.result) {
                $scope.response = "Punto de Venta: <strong>" + formData.PtoVta + "</strong><br/>"
                $scope.response += "Tipo de Comprobante: <strong>" + _.find($scope.CbteTipo,{Id: formData.CbteTipo.Id}).Desc + "</strong><br/>"
                $scope.response += "Nº Último Comprobante: <strong>" + res.data.data + "</strong>";
                $scope.responseCollapsed = false;
            } else {
                $scope.responseCollapsed = true;
                $scope.response = undefined;
                var errs = "";

                if (angular.isArray(res.data.err)) {
                    _.forEach(res.data.err, function(e) {
                        errs += "<p><strong>Error " + e.Code + "</strong><br/>" + e.Msg + "</p>";
                    });
                } else {
                    errs = res.data.err;
                }

                toastr.error(errs);
            }
        }, function(res) {
            console.log(res);

            $scope.responseCollapsed = true;
            $scope.response = undefined;
            $loading.finish('lastCbte');
            toastr.error(res.data || TEXT_ERRORS.ERR_API_CONNECTION);
        });
    }
}]);

app.controller('LoginController', ['$scope', '$rootScope', '$http', '$location', '$localStorage', 'toastr', '$loading', function($scope, $rootScope, $http, $location, $localStorage, toastr, $loading) {    
    if ($localStorage.currentUser) {
        $location.path('dashboard');
    }

    $scope.formData = {};

    $scope.login = function() {
        $loading.start('login');

        $http.post('/api/login', $scope.formData)
            .then(function(res) {
            $loading.finish('login');   

            if(res.data.result) {
                $localStorage.currentUser = {
                    token: res.data.token
                }

                $rootScope.loggedIn = true;

                $http.defaults.headers.common.Authorization = res.data.token;

                $location.path('dashboard');
                toastr.success("¡Bienvenido al nuevo sistema de Facturación Electrónica!");
            } else {
                toastr.error(res.data.err);
            }
        }, function(res) {
            $loading.finish('login');
            toastr.error(res.data || TEXT_ERRORS.ERR_API_CONNECTION);
        });
    }
}]);
 
app.directive("compareTo", function() {
    return {
        require: "ngModel",
        scope: {
            otherModelValue: "=compareTo"
        },
        link: function(scope, element, attributes, ngModel) {
             
            ngModel.$validators.compareTo = function(modelValue) {
                return modelValue == scope.otherModelValue;
            };
 
            scope.$watch("otherModelValue", function() {
                ngModel.$validate();
            });
        }
    };
});

app.config(function($routeProvider, $locationProvider) {
    $locationProvider.hashPrefix('');

    $routeProvider
        .when('/', {
        templateUrl: 'pages/login.html',
        controller: 'LoginController'
    })
        .when('/dashboard', {
        templateUrl: 'pages/dashboard.html',
        controller: 'DashboardController'
    })
        .when('/reportes', {
        templateUrl: 'pages/reportes.html',
        controller: 'ReportingController'
    })
        .otherwise({
        redirectTo: '/'
    });
});

app.config(function(toastrConfig) {
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
});
