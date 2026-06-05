import 'dotenv/config'
import express from 'express'
import { paymentMiddleware, setSettlementOverrides, x402ResourceServer } from '@x402/express'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { UptoEvmScheme } from '@x402/evm/upto/server'
import { HTTPFacilitatorClient } from '@x402/core/server'

const app = express()
const PORT = parseInt(process.env.PORT || '4021', 10)
const EVM_ADDRESS = process.env.EVM_ADDRESS || '0xYourEvmWalletAddress'
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://x402.org/facilitator'
const NETWORK = (process.env.NETWORK || 'eip155:84532') as `${string}:${string}`

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL })

const server = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme())
  .register(NETWORK, new UptoEvmScheme())

app.use(
  paymentMiddleware(
    {
      'GET /weather': {
        accepts: [
          {
            scheme: 'exact',
            price: '$0.001',
            network: NETWORK,
            payTo: EVM_ADDRESS,
          },
        ],
        description: 'Current weather data for a given city',
        mimeType: 'application/json',
      },
      'GET /api/generate': {
        accepts: [
          {
            scheme: 'upto',
            price: '$0.10',
            network: NETWORK,
            payTo: EVM_ADDRESS,
          },
        ],
        description: 'AI text generation — billed by token usage',
        mimeType: 'application/json',
      },
    },
    server,
  ),
)

app.get('/weather', (_req, res) => {
  res.json({
    report: {
      weather: 'sunny',
      temperature: 70,
      humidity: 45,
      city: 'San Francisco',
    },
  })
})

app.get('/api/generate', (_req, res) => {
  const maxAmountAtomic = 100000
  const actualUsage = Math.floor(Math.random() * (maxAmountAtomic + 1))

  setSettlementOverrides(res, { amount: String(actualUsage) })

  res.json({
    result: 'Here is your generated text content from the x402 seller server.',
    usage: {
      authorizedMaxAtomic: String(maxAmountAtomic),
      actualChargedAtomic: String(actualUsage),
    },
  })
})

app.get('/public', (_req, res) => {
  res.json({ message: 'This is a free public endpoint. No payment required.' })
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', facilitator: FACILITATOR_URL, address: EVM_ADDRESS })
})

app.listen(PORT, () => {
  console.log(`XPayLabs x402 seller server running at http://localhost:${PORT}`)
  console.log(`  EVM Address: ${EVM_ADDRESS}`)
  console.log(`  Facilitator: ${FACILITATOR_URL}`)
  console.log('')
  console.log('  Endpoints:')
  console.log(`    GET /weather       — exact payment $0.001 (${NETWORK})`)
  console.log(`    GET /api/generate  — upto payment $0.10 max (${NETWORK})`)
  console.log('    GET /public        — free, no payment')
  console.log('    GET /health        — health check')
  console.log('')
  console.log('  First request returns 402 → buyer signs → retry → 200')
})
