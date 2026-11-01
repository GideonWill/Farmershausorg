import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backend = path.join(root, 'backend')
const isWindows = process.platform === 'win32'
const pythonInVenv = path.join(
  backend,
  '.venv',
  isWindows ? 'Scripts' : 'bin',
  isWindows ? 'python.exe' : 'python',
)

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: isWindows && command.endsWith('.cmd'),
    ...options,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1
    return false
  }

  return true
}

function findSystemPython() {
  const candidates = isWindows
    ? [['py', ['-3.14']], ['py', ['-3.13']], ['py', ['-3.12']]]
    : [['python3.14', []], ['python3.13', []], ['python3.12', []], ['python3', []]]

  for (const [command, args] of candidates) {
    const result = spawnSync(command, [...args, '--version'], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    })
    const version = `${result.stdout ?? ''}${result.stderr ?? ''}`
    if (result.status === 0 && /Python 3\.(12|13|14)\./.test(version)) {
      return { command, args }
    }
  }

  throw new Error(
    'A supported Python 3.12–3.14 runtime was not found. Install one, then reopen the terminal.',
  )
}

function ensureDevelopmentEnv() {
  const envFile = path.join(backend, '.env')
  if (!existsSync(envFile)) {
    copyFileSync(path.join(backend, '.env.example'), envFile)
  }

  const envText = readFileSync(envFile, 'utf8')
  if (/^DJANGO_SECRET_KEY=replace-with-a-random-local-development-secret$/m.test(envText)) {
    writeFileSync(
      envFile,
      envText.replace(
        /^DJANGO_SECRET_KEY=replace-with-a-random-local-development-secret$/m,
        `DJANGO_SECRET_KEY=${randomBytes(48).toString('base64url')}`,
      ),
    )
  }
}

function setup() {
  const systemPython = findSystemPython()
  if (!existsSync(pythonInVenv)) {
    if (!run(systemPython.command, [...systemPython.args, '-m', 'venv', path.join(backend, '.venv')], root)) {
      return
    }
  }

  ensureDevelopmentEnv()
  if (!run(pythonInVenv, ['-m', 'pip', 'install', '--upgrade', 'pip'], backend)) {
    return
  }
  run(pythonInVenv, ['-m', 'pip', 'install', '-e', '.'], backend)
}

const command = process.argv[2]
if (!command) {
  console.error('Usage: node scripts/backend.mjs <setup|check|makemigrations|migrate|test|seed_demo_data|runserver>')
  process.exitCode = 2
} else if (command === 'setup') {
  try {
    setup()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
} else {
  if (!existsSync(pythonInVenv)) {
    console.error('Backend environment is missing. Run "npm run backend:setup" first.')
    process.exitCode = 1
  } else {
    const extraArgs = process.argv.slice(3)
    const djangoCommand = command === 'runserver' ? ['runserver', ...extraArgs] : [command, ...extraArgs]
    const child = spawn(pythonInVenv, ['manage.py', ...djangoCommand], {
      cwd: backend,
      stdio: 'inherit',
    })
    child.on('error', (error) => {
      console.error(`Could not start Django: ${error.message}`)
      process.exitCode = 1
    })
    child.on('exit', (code, signal) => {
      process.exitCode = code ?? (signal ? 1 : 0)
    })
  }
}
