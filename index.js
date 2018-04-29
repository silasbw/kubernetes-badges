const promisify = require('util').promisify
const badge = promisify((format, cb) => require('gh-badges')(format, (svg, err) => cb(err, svg)))
const express = require('express')
const http = require('http')
const kubernetes = require('kubernetes-client')
const terminus = require('@godaddy/terminus')

const app = express()
let client

function getImageTag (image) {
  const name = image.split('/').slice(-1)[0]
  const splits = name.split(':')
  if (splits.length < 2) return 'latest'
  return splits[1]
}

const wrap = fn => (req, res, next) => fn(req, res).catch(next)
app.get('/ns/:namespace/deploy/:deployment', wrap(async (req, res) => {
  let apiRes
  if (client.apis.apps.v1) {
    apiRes = await client.apis
      .apps
      .v1
      .namespaces(req.params.namespace)
      .deployments(req.params.deployment)
      .get()
  } else {
    apiRes = await client.apis
      .extensions
      .v1beta1
      .namespaces(req.params.namespace)
      .deployments(req.params.deployment)
      .get()
  }

  //
  // Describe the Deployment by concatenating the container image paths.
  //
  const containers = apiRes.body.spec.template.spec.containers
  const imageTags = containers.map(container => getImageTag(container.image))
  const subject = encodeURIComponent(req.query.subject || 'deploy')
  const status = ` ${imageTags.join(' ')} `
  const format = {
    text: [ subject, status ],
    format: 'svg',
    colorscheme: 'green',
    template: 'flat'
  }
  const svg = await badge(format)

  res.set('Content-Type', 'image/svg+xml')
  res.status(200).send(svg).end()
}))

async function main () {
  let config
  try {
    config = kubernetes.config.getInCluster()
  } catch (err) {
    config = kubernetes.config.fromKubeconfig()
  }
  client = new kubernetes.Client({ config })
  await client.loadSpec()

  const server = http.createServer(app)
  terminus(server, {
    healthChecks: {
      '/healthcheck': () => Promise.resolve()
    }
  })
  server.listen(8080)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
