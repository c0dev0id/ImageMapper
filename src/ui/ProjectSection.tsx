import { unwrap } from 'solid-js/store'
import { setHelp } from '../help/help.ts'
import { ABOUT_HELP } from '../help/topics.tsx'
import { useMapAccessor } from '../map/context.ts'
import { allImageBytes } from '../state/images.ts'
import { adoptProject } from '../state/persistence.ts'
import { project, setProjectName } from '../state/project.ts'
import { decodeProjectFile, encodeProjectFile } from '../state/projectFile.ts'
import { emptyProject, hasContent } from '../state/schema.ts'
import { errorMessage, notify, panelCollapsed, setPanelCollapsed } from '../state/ui.ts'
import { downloadBlob, fileBaseName } from './download.ts'
import { EditableName } from './EditableName.tsx'
import { InfoIcon } from './icons.tsx'

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
      if (hasContent(project) && !confirm('Replace the current project with the opened file?')) return
      await adoptProject(next, images)
      map()?.jumpTo({ center: next.view.center, zoom: next.view.zoom, bearing: next.view.bearing, pitch: next.view.pitch })
    } catch (error) {
      notify(`${file.name} could not be opened: ${errorMessage(error)}`)
    }
  }

  const startNew = async () => {
    if (hasContent(project) && !confirm('Start a new project? The current one is removed from this browser.')) return
    await adoptProject({ ...emptyProject(), view: { ...unwrap(project.view) } }, new Map())
  }

  return (
    <header class="section panel-header">
      <div class="row title-row">
        <h1>Image Mapper</h1>
        <button
          class="icon help-button about-button"
          title="About Image Mapper"
          aria-label="About Image Mapper"
          onClick={() => setHelp(ABOUT_HELP)}
        >
          <InfoIcon />
        </button>
        <button
          class="icon panel-toggle"
          aria-label={panelCollapsed() ? 'Show panel' : 'Hide panel'}
          aria-expanded={!panelCollapsed()}
          onClick={() => setPanelCollapsed((c) => !c)}
        >
          {panelCollapsed() ? '▴' : '▾'}
        </button>
      </div>
      <div class="row">
        <EditableName value={project.name} label="project" onRename={setProjectName} />
      </div>
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
