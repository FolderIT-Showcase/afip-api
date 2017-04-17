# AFIP API
Sistema de utilización simplificada de servicios web publicados por AFIP

# Tecnologías
* MongoDB 3.4.3
* Express.js 4.13.4
* AngularJS 1.6.4
* Node.js 7.0.0

# Requerimientos Previos
Las siguientes herramientas y librerías deben instalarse y configurarse en el sistema de desarrollo y producción:
* NPM
* Bower
* Winser
* OpenSSL
* En entornos Windows: windows-build-tools

# Instalación
1. Clonar el repositorio en el equipo de desarrollo o servidor de producción

2. (En entornos Windows) Ejecutar en la línea de comandos en consola:
```
> npm install --global windows-build-tools
> npm install --global node-gyp
> setx PYTHON "%USERPROFILE%\.windows-build-tools\python27\python.exe"
```

3. (En entornos Windows) Instalar OpenSSL. Ver: https://slproweb.com/products/Win32OpenSSL.html

4. Desde línea de comandos en consola, ejecutar:
```
> npm install --global bower
> npm install
> bower install
```

5. El sistema utiliza la variable de entorno NODE_ENV ('development' por defecto) para definir el entorno de ejecución y la variable PORT ('3000' por defecto) para definir el puerto del servidor web.

6. Para ejecutar el sistema se puede utilizar `nodemon`, `forever`, `winser` o `systemd` (en entornos Unix)
