@description('Región de Azure (pública).')
param location string = 'eastus'

@description('Nombre global único del Web App (solo letras minúsculas y números).')
param appName string

@description('F1 = gratis (con límites); B1 = básico de pago.')
@allowed(['F1', 'B1'])
param skuName string = 'F1'

var planName = '${appName}-plan'

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: {
    name: skuName
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.12'
      alwaysOn: skuName != 'F1'
      appCommandLine: 'gunicorn -w 2 -k uvicorn.workers.UvicornWorker app.main:app --bind=0.0.0.0:8000'
      appSettings: [
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
        { name: 'WEBSITES_PORT', value: '8000' }
        { name: 'ENABLE_ORYX_BUILD', value: 'true' }
      ]
    }
  }
}

output defaultHostName string = app.properties.defaultHostName
output apiUrl string = 'https://${app.properties.defaultHostName}/api/planned-surveys/xml'
output docsUrl string = 'https://${app.properties.defaultHostName}/docs'
output healthUrl string = 'https://${app.properties.defaultHostName}/health'
