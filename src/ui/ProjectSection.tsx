import { unwrap } from 'solid-js/store'
import { useMapAccessor } from '../map/context.ts'
import { allImageBytes } from '../state/images.ts'
import { adoptProject } from '../state/persistence.ts'
import { project, setProjectName } from '../state/project.ts'
import { decodeProjectFile, encodeProjectFile } from '../state/projectFile.ts'
import { emptyProject } from '../state/schema.ts'
import { errorMessage, notify } from '../state/ui.ts'
import { downloadBlob, fileBaseName } from './download.ts'

const hasContent = () => project.layers.length > 0 || project.routes.length > 0

export function ProjectSection() {
  const map = useMapAccessor()

  const save = () => {
    try {
      const file = encodeProjectFile(unwrap(project), allImageBytes())
      downloadBlob(new Blob([file], { type: 'application/zip' }), `${fileBaseName(project.name)}.mappic`)
    } catch (error) {
      notify(`The project could not be saved: ${errorMessage(error)}`)
    }
  }

  const open = async (file: File) => {
    try {
      const { project: next, images } = decodeProjectFile(new Uint8Array(await file.arrayBuffer()))
      if (hasContent() && !confirm('Replace the current project with the opened file?')) return
      await adoptProject(next, images)
      map()?.jumpTo({ center: next.view.center, zoom: next.view.zoom, bearing: next.view.bearing, pitch: next.view.pitch })
    } catch (error) {
      notify(`${file.name} could not be opened: ${errorMessage(error)}`)
    }
  }

  const startNew = async () => {
    if (hasContent() && !confirm('Start a new project? The current one is removed from this browser.')) return
    await adoptProject({ ...emptyProject(), view: { ...unwrap(project.view) } }, new Map())
  }

  return (
    <header class="section">
      <h1>mappic</h1>
      <input
        class="project-name"
        aria-label="Project name"
        value={project.name}
        onChange={(e) => setProjectName(e.currentTarget.value.trim() || 'Untitled')}
      />
      <div class="row buttons">
        <button title="Download the project with all images as a .mappic file" onClick={save}>
          Save
        </button>
        <label class="button" title="Open a .mappic project file">
          Open
          <input
            type="file"
            hidden
            accept=".mappic,application/zip"
            onChange={(e) => {
              const input = e.currentTarget
              const file = input.files?.[0]
              input.value = ''
              if (file) void open(file)
            }}
          />
        </label>
        <button onClick={() => void startNew()}>New</button>
      </div>
    </header>
  )
}
