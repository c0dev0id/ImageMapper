import { render } from 'solid-js/web'
import { App } from './App.tsx'
import './styles.css'
import { initTheme } from './ui/theme.ts'

initTheme()
render(() => <App />, document.getElementById('root')!)
