import React, {useMemo, useState} from 'react';
import {Button, Icon, Menu, MenuItem, Popover} from "@blueprintjs/core";
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

interface VersionInfo {
  tag: string;
  language?: string;
  languageIcon?: string;
}

interface ProjectEntry {
  name: string;
  icon?: string;
  language?: string;
  languageIcon?: string;
  versions?: VersionInfo[];
  children?: ProjectChild[];
}

type ProjectChild = FileChild | LibrariesChild;

interface FileChild {
  type: 'file';
  name: string;
  library?: string;
  icon?: string;
  language?: string;
  languageIcon?: string;
  versions?: VersionInfo[];
  snippet?: string;
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
    language: 'Ray',
    languageIcon: 'circle',
    versions: [
      { tag: 'v1.0.0' },
      { tag: 'v0.9.0', language: 'Set Theory' },
    ],
    children: [
      {
        type: 'file',
        name: 'UUID.ray',
        icon: 'document',
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
    language: 'Set Theory',
    languageIcon: 'circle',
    versions: [
      { tag: 'v2.0.0', language: 'Ray' },
      { tag: 'v1.0.0' },
    ],
    children: [
      {
        type: 'file',
        name: 'set.mm',
        versions: [
          { tag: 'v1.0.0', language: 'Ray' },
        ],
        snippet: 'UUID: UUID("asadasdasdasdasdddaaaaaaaaaaaaa"',
      },
    ],
  },
  {
    name: 'UUID',
    language: 'UUID',
    languageIcon: 'circle',
    versions: [
      { tag: 'v1.0.0', language: 'Ray' },
      { tag: 'v0.1.0' },
    ],
    children: [
      {
        type: 'file',
        name: 'UUID.ray',
        library: 'Ray',
        versions: [
          { tag: 'v1.0.0', language: 'Ray' },
        ],
        snippet: 'UUID: UUID("asadasdasdasdasdddaaaaaaaaaaaaa"',
      },
    ],
  },
];

// ─── Rendering Components ────────────────────────────────────────────────────

const snippetStyle = {width: '100%', fontSize: '12px', padding: '10px', margin: '5px'};

const FileName = ({ name, library }: { name: string; library?: string }) => {
  if (library) {
    return <span>{library} <span className="bp5-text-muted">{'//'}</span> <span className="bp5-text-disabled">{name}</span></span>;
  }
  return <span className="bp5-text-disabled">{name}</span>;
}

interface LanguageProps {
  versions?: VersionInfo[];
  defaultLanguage?: string;
  defaultLanguageIcon?: string;
}

const Language = ({children, versions, defaultLanguage, defaultLanguageIcon}: Children & LanguageProps) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const hasVersions = versions && versions.length > 0;
  const selected = hasVersions ? versions[Math.min(selectedIdx, versions.length - 1)] : null;
  const resolvedLanguage = selected ? (selected.language || defaultLanguage || '') : '';
  const resolvedIcon = selected ? (selected.languageIcon || defaultLanguageIcon || 'circle') : 'circle';

  return <>
    <Button minimal className="p-0" style={{minWidth: '0', flex: '1 1 auto', justifyContent: 'left'}}>
      <Row middle="xs" className="child-pr-3">
        {children}
      </Row>
    </Button>
    {hasVersions && selected && <Col>
      <Row>
        <Button minimal><Icon icon="add" intent="success" size={16}/></Button>
        <Col>
          <Row center="xs">
            <Popover
              content={
                <Menu>
                  {versions!.map((v, i) => {
                    const vLang = v.language || defaultLanguage || '';
                    const vIcon = v.languageIcon || defaultLanguageIcon || 'circle';
                    return <MenuItem
                      key={i}
                      text={v.tag}
                      label={vLang}
                      icon={vIcon as any}
                      active={i === selectedIdx}
                      onClick={() => setSelectedIdx(i)}
                    />;
                  })}
                </Menu>
              }
              placement="bottom-start"
              minimal
            >
              <Button minimal className="pb-0">
                <Row center="xs" middle="xs" className="bp5-text-muted">
                  <Icon icon="git-branch" className="pr-3" size={12}/>
                  <h5>{selected.tag}</h5>
                  <Icon icon="caret-down" />
                </Row>
              </Button>
            </Popover>
          </Row>
          <Row center="xs" middle="xs">
            <Button minimal style={{fontSize: '10px', height: '100%'}}
              icon={<Icon icon={resolvedIcon as any} size={10} />}
              className="p-0">
              {resolvedLanguage}
            </Button>
          </Row>
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

const FileChildView = ({ file, defaultLanguage, defaultLanguageIcon }: { file: FileChild; defaultLanguage?: string; defaultLanguageIcon?: string }) => {
  const icon = file.icon || 'circle';
  const hasVersions = file.versions && file.versions.length > 0;
  const fileLang = file.language || defaultLanguage;
  const fileIcon = file.languageIcon || defaultLanguageIcon;
  return <>
    {hasVersions ? (
      <Row><Language versions={file.versions} defaultLanguage={fileLang} defaultLanguageIcon={fileIcon}>
        <Icon icon={icon as any} size={14} />
        <FileName name={file.name} library={file.library} />
      </Language></Row>
    ) : (
      <Row middle="xs" className="child-pr-3">
        <Icon icon={icon as any} size={14} className="bp5-text-disabled" />
        <FileName name={file.name} library={file.library} />
      </Row>
    )}
    {file.snippet && <Snippet text={file.snippet} />}
  </>;
}

const ProjectEntryView = ({ project }: { project: ProjectEntry }) => {
  const icon = project.icon || 'circle';
  const hasVersions = project.versions && project.versions.length > 0;
  return <>
    <Row middle="xs" between="xs">
      {hasVersions ? (
        <Language versions={project.versions} defaultLanguage={project.language} defaultLanguageIcon={project.languageIcon}>
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
            ? <FileChildView key={i} file={child} defaultLanguage={project.language} defaultLanguageIcon={project.languageIcon} />
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
