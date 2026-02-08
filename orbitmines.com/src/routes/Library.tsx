import React, {useMemo} from 'react';
import {Button, Icon} from "@blueprintjs/core";
import {Block, Children, Col, CustomIcon, HorizontalLine, Row} from "../lib/post/Post";
import {useNavigate} from "react-router-dom";
import {Helmet} from "react-helmet";
import ORGANIZATIONS, {TProfile} from "../lib/organizations/ORGANIZATIONS";
import IDELayout, {generateId, LayoutNode, PanelDefinition} from "../lib/layout/IDELayout";

const Socials = ({ profile }: { profile: TProfile }) => {
  return <Row center="xs" className="child-pt-1 child-px-2">
    {profile.external.map(profile =>
      <Col>
        <a href={profile.link} target="_blank">
          <CustomIcon icon={profile.organization.key} size={20}/>
        </a>
      </Col>)}
  </Row>
}

// ─── Project Data Model ──────────────────────────────────────────────────────

interface ProjectEntry {
  name: string;
  icon?: string;
  version?: string;
  language?: string;
  children?: ProjectChild[];
}

type ProjectChild = FileChild | LibrariesChild;

interface FileChild {
  type: 'file';
  name: string;
  icon?: string;
  version?: string;
  language?: string;
  disabled?: boolean;
  snippet?: string;
  reference?: { name: string; icon?: string };
}

interface LibrariesChild {
  type: 'libraries';
  count?: number;
  entries: LibraryEntryData[];
}

interface LibraryEntryData {
  name: string;
  icon?: string;
  snippet?: string;
  reference?: { name: string; icon?: string };
}

// ─── Dataset ─────────────────────────────────────────────────────────────────

const PROJECTS: ProjectEntry[] = [
  {
    name: 'Ray',
    version: 'v1.0.0',
    language: 'Language',
    children: [
      {
        type: 'file',
        name: 'UUID.ray',
        icon: 'document',
        disabled: true,
        snippet: 'UUID: UUID("asadasdasdasdasdddaaaaaaaaaaaaa"',
      },
      {
        type: 'libraries',
        count: 10000,
        entries: [
          {
            name: 'Library',
            snippet: 'UUID: UUID("asadasdasdasdasdddaaaaaaaaaaaaa"',
          },
          {
            name: 'Library',
            reference: { name: 'Language' },
            snippet: 'UUID: UUID("asadasdasdasdasdddaaaaaaaaaaaaa"',
          },
        ],
      },
    ],
  },
  {
    name: 'Set Theory',
    children: [
      {
        type: 'file',
        name: 'set.mm',
        version: 'v1.0.0',
        language: 'Language',
        snippet: 'UUID: UUID("asadasdasdasdasdddaaaaaaaaaaaaa"',
      },
    ],
  },
  {
    name: 'UUID',
    version: 'v1.0.0',
    language: 'Language',
    children: [
      {
        type: 'file',
        name: 'Ray // UUID.ray',
        version: 'v1.0.0',
        language: 'Language',
        snippet: 'UUID: UUID("asadasdasdasdasdddaaaaaaaaaaaaa"',
      },
    ],
  },
];

// ─── Rendering Components ────────────────────────────────────────────────────

const snippetStyle = {width: '100%', fontSize: '12px', padding: '10px', margin: '5px'};

const Language = ({children, version, language}: Children & { version?: string; language?: string }) => {
  const hasControls = version || language;
  return <>
    <Button minimal className="p-0" style={{minWidth: '0', flex: '1 1 auto', justifyContent: 'left'}}>
      <Row middle="xs" className="child-pr-3">
        {children}
      </Row>
    </Button>
    {hasControls && <Col>
      <Row>
        <Button minimal><Icon icon="add" intent="success" size={16}/></Button>
        <Col>
          {version && <Row center="xs">
            <Button minimal className="pb-0">
              <Row center="xs" middle="xs" className="bp5-text-muted">
                <Icon icon="git-branch" className="pr-3" size={12}/><h5>{version}</h5><Icon icon="caret-down" />
              </Row>
            </Button>
          </Row>}
          {language && <Row center="xs" middle="xs">
            <Button minimal style={{fontSize: '10px', height: '100%'}} icon={<Icon icon="circle" size={10} />} className="p-0">
              {language}
            </Button>
          </Row>}
        </Col>
      </Row>
    </Col>}
  </>
}

const Snippet = ({ text }: { text: string }) =>
  <Block style={snippetStyle}>{text}</Block>

const LibraryEntryView = ({ entry }: { entry: LibraryEntryData }) => {
  const icon = entry.icon || 'circle';
  return <>
    <Row middle="xs" className="child-pr-3">
      <Icon icon={icon as any} size={14} />
      {entry.reference
        ? <><span>{entry.name} <span className="bp5-text-muted">-{'>'}</span></span><Icon icon={(entry.reference.icon || 'circle') as any} size={14} />{entry.reference.name}</>
        : entry.name
      }
    </Row>
    {entry.snippet && <Snippet text={entry.snippet} />}
  </>;
}

const LibrariesView = ({ data }: { data: LibrariesChild }) => <>
  <Row middle="xs" className="child-pr-3">
    <Icon icon="git-repo" size={14} />
    <span>Libraries{data.count !== undefined && <span className="bp5-text-muted"> ({data.count.toLocaleString()})</span>}</span>
  </Row>
  <Row className="pl-8">
    {data.entries.map((entry, i) =>
      <LibraryEntryView key={i} entry={entry} />
    )}
  </Row>
</>

const FileChildView = ({ file }: { file: FileChild }) => {
  const icon = file.icon || 'circle';
  const hasControls = file.version || file.language;
  return <>
    {hasControls ? (
      <Row><Language version={file.version} language={file.language}>
        <Icon icon={icon as any} size={14} /><span>{file.name}</span>
      </Language></Row>
    ) : (
      <Row middle="xs" className="child-pr-3">
        <Icon icon={icon as any} size={14} className={file.disabled ? 'bp5-text-disabled' : ''} />
        <span className={file.disabled ? 'bp5-text-disabled' : ''}>{file.name}</span>
      </Row>
    )}
    {file.snippet && <Snippet text={file.snippet} />}
  </>;
}

const ProjectEntryView = ({ project }: { project: ProjectEntry }) => {
  const icon = project.icon || 'circle';
  const hasControls = project.version || project.language;
  return <>
    <Row middle="xs" between="xs">
      {hasControls ? (
        <Language version={project.version} language={project.language}>
          <Icon icon={icon as any} size={16} />
          <h3>{project.name}</h3>
        </Language>
      ) : (
        <Button minimal className="p-0" style={{minWidth: '0', flex: '1 1 auto', justifyContent: 'left'}}>
          <Row middle="xs" className="child-pr-3">
            <Icon icon={icon as any} size={16} />
            <h3>{project.name}</h3>
          </Row>
        </Button>
      )}
    </Row>
    {project.children && project.children.length > 0 && <Row>
      <Col xs={12} className="pl-8">
        {project.children.map((child, i) =>
          child.type === 'file'
            ? <FileChildView key={i} file={child} />
            : <LibrariesView key={i} data={child} />
        )}
      </Col>
    </Row>}
  </>;
}

const ProjectList = ({ projects }: { projects: ProjectEntry[] }) => <>
  {projects.map((project, i) =>
    <ProjectEntryView key={i} project={project} />
  )}
</>

const SettingsPanel = ({ profile }: { profile: TProfile }) => <>
  <Row middle="xs" className="child-pr-3"><Icon icon="settings" /><h3>Settings</h3></Row>
  <Row>
    <Col xs={12}><h4 className="bp5-text-muted">Preferences</h4></Col>
    <Col xs={12}>
      <Row className="child-pr-4" middle="xs"><h4 className="bp5-text-muted">Reference Language</h4><Icon icon="edit" size={14} /></Row>
      <Button minimal style={{width: '100%', justifyContent: 'start'}}><Row className="child-pr-2" start="xs" middle="xs" style={{width: '100%'}}>
        <Icon icon="circle" size={14} /><span>Ray <span className="bp5-text-muted">v1.0.0</span></span>
      </Row></Button>
    </Col>
    <Col xs={12}>
      <Row className="child-pr-4" middle="xs"><h4 className="bp5-text-muted">Universal Language</h4><Icon icon="edit" size={14} /></Row>
      <Button minimal style={{width: '100%', justifyContent: 'start'}}><Row className="child-pr-2" start="xs" middle="xs" style={{width: '100%'}}>
        <Icon icon="circle" size={14} /><span>Ray <span className="bp5-text-muted">v1.0.0</span></span>
      </Row></Button>
    </Col>
    <Col xs={12}><HorizontalLine/></Col>
    <Col xs={12}><h4 className="bp5-text-muted">Selection</h4></Col>
    <Col xs={12}>
      <ProjectList projects={PROJECTS} />
    </Col>
  </Row>
</>

const DisplayPanel = ({ profile }: { profile: TProfile }) => <>
  <Row middle="xs" className="child-pr-3">
    <Icon icon="circle" size={18} />
    <h2>Ray</h2>
  </Row>
  <Row><Col className="pl-12"><Socials profile={profile}/></Col></Row>
</>

const Library = () => {
  const navigate = useNavigate();

  const profile: TProfile = {
    external: [
      { organization: ORGANIZATIONS.discord, display: 'discord.orbitmines.com', link: 'https://discord.orbitmines.com' },
      { organization: ORGANIZATIONS.github, display: 'orbitmines', link: 'https://github.com/orbitmines/ray/tree/main/Ether/library' },
    ]
  }

  const panels = useMemo<PanelDefinition[]>(() => [
    {
      id: 'projects',
      title: 'Projects',
      icon: 'git-repo',
      render: () => <ProjectList projects={PROJECTS} />,
      closable: false,
    },
    {
      id: 'display',
      title: 'Ray',
      icon: 'circle',
      render: () => <DisplayPanel profile={profile} />,
      closable: false,
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'settings',
      render: () => <SettingsPanel profile={profile} />,
      closable: false,
    },
  ], []);

  const initialLayout = useMemo<LayoutNode>(() => ({
    type: 'split',
    id: generateId(),
    direction: 'horizontal',
    children: [
      { type: 'tabgroup', id: generateId(), panels: ['projects'], activeIndex: 0 },
      { type: 'tabgroup', id: generateId(), panels: ['display'], activeIndex: 0 },
      { type: 'tabgroup', id: generateId(), panels: ['settings'], activeIndex: 0 },
    ],
    sizes: [0.25, 0.50, 0.25],
  }), []);

  return <Row center="xs">
    <Helmet>
      <title lang="en">Ether Library: The Language Index</title>
    </Helmet>

    <Row style={{width: '100%'}}>
      <Row between="xs" style={{width: '100%'}} className="pt-10 px-15">
        <Button icon="arrow-left" minimal onClick={() => navigate('/')} />

        <Col>
          <h1>Ether Library: The Language Index</h1>
          <Socials profile={profile} />
        </Col>
      </Row>

      <div style={{width: '100%', height: 'calc(100vh - 80px)', maxWidth: '1650px', margin: '0 auto'}} className="pt-20">
        <IDELayout panels={panels} initialLayout={initialLayout} />
      </div>
    </Row>
  </Row>
};

export default Library;
