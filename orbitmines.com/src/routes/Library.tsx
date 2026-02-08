import React, {useCallback, useContext, useMemo, useRef, useState} from 'react';
import {Button, Icon, Menu, MenuItem, Popover, Tag} from "@blueprintjs/core";
import {Block, Col, CustomIcon, HorizontalLine, Row} from "../lib/post/Post";
import {useNavigate} from "react-router-dom";
import {Helmet} from "react-helmet";
import ORGANIZATIONS, {TProfile} from "../lib/organizations/ORGANIZATIONS";
import IDELayout, {generateId, IDELayoutHandle, LayoutNode, PanelDefinition} from "../lib/layout/IDELayout";

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

// ─── Data Model ──────────────────────────────────────────────────────────────

type LanguageRef = string | { name: string; icon?: string };

function resolveLanguageRef(ref?: LanguageRef): { name?: string; icon?: string } {
  if (!ref) return {};
  if (typeof ref === 'string') return { name: ref };
  return ref;
}

function resolveLanguage(ref?: LanguageRef, defaultRef?: LanguageRef): { name: string; icon: string } {
  const resolved = resolveLanguageRef(ref);
  const defaults = resolveLanguageRef(defaultRef);
  return {
    name: resolved.name || defaults.name || '',
    icon: resolved.icon || defaults.icon || 'circle',
  };
}

interface Entry {
  type?: 'file' | 'library';
  name: string;
  icon?: string;
  language?: LanguageRef;
  library?: string;
  reference?: { name: string; icon?: string };
  versions?: Version[];
  snippet?: string;
}

interface Version {
  tag: string;
  language?: LanguageRef;
  children?: VersionChild[];
}

type VersionChild = Entry | LibrariesGroup;

interface LibrariesGroup {
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

const PROJECTS: Entry[] = [
  {
    name: 'Ray',
    language: { name: 'Ray', icon: 'circle' },
    versions: [
      {
        tag: 'v1.0.0',
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
        tag: 'v1.0.0',
        language: 'Set Theory',
      },
      { tag: 'v0.9.0', language: 'Set Theory' },
      { tag: 'v0.9.0' },
    ],
  },
  {
    name: 'Set Theory',
    language: { name: 'Set Theory', icon: 'circle' },
    versions: [
      {
        tag: 'v2.0.0',
        language: 'Ray',
        children: [
          {
            type: 'library',
            name: 'set.mm',
            snippet: 'UUID: UUID("asadasdasdasdasdddaaaaaaaaaaaaa"',
          },
        ],
      },
      { tag: 'v2.0.0' },
      {
        tag: 'v1.0.0',
        children: [
          {
            type: 'library',
            name: 'set.mm',
            versions: [
              { tag: 'v1.0.0', language: 'Ray' },
              { tag: 'v1.0.0' },
            ],
            snippet: 'UUID: UUID("asadasdasdasdasdddaaaaaaaaaaaaa"',
          },
        ],
      },
      { tag: 'v1.0.0', language: 'Ray' },
    ],
  },
  {
    name: 'UUID',
    language: { name: 'UUID', icon: 'circle' },
    versions: [
      {
        tag: 'v1.0.0',
        language: 'Ray',
        children: [
          {
            type: 'file',
            name: 'UUID.ray',
            library: 'Ray',
            versions: [
              { tag: 'v1.0.0', language: 'Ray' },
              { tag: 'v1.0.0' },
            ],
            snippet: 'UUID: UUID("asadasdasdasdasdddaaaaaaaaaaaaa"',
          },
        ],
      },
      { tag: 'v1.0.0' },
      { tag: 'v0.1.0' },
    ],
  },
];

// ─── Open Entry Context ─────────────────────────────────────────────────────

const OpenEntryContext = React.createContext<((entry: Entry) => void) | null>(null);

// ─── Selection Context ──────────────────────────────────────────────────────

const SelectionContext = React.createContext<{
  selectedKeys: Set<string>;
  onSelect: (key: string, e: React.MouseEvent) => void;
}>({ selectedKeys: new Set(), onSelect: () => {} });

const SelectableEntry = ({ entry, children }: { entry: Entry; children: React.ReactNode }) => {
  const id = React.useId();
  const { selectedKeys, onSelect } = useContext(SelectionContext);
  const openEntryFn = useContext(OpenEntryContext);
  const isSelected = selectedKeys.has(id);

  const handleClick = useCallback((e: React.MouseEvent) => {
    onSelect(id, e);
    openEntryFn?.(entry);
  }, [id, entry, onSelect, openEntryFn]);

  return (
    <div
      data-entry-key={id}
      onClick={handleClick}
      className={`selectable-entry${isSelected ? ' selectable-entry--selected' : ''}`}
    >
      {children}
    </div>
  );
};

// ─── Rendering Components ────────────────────────────────────────────────────

const snippetStyle = {width: '100%', fontSize: '12px', padding: '10px', margin: '5px'};

const Snippet = ({ text }: { text: string }) =>
  <Block style={snippetStyle}>{text}</Block>

const EntryName = ({ entry }: { entry: Entry }) => {
  const isFile = entry.type === 'file';
  if (entry.library) {
    return <span>
      {entry.library} <span className="bp5-text-muted">{'//'}</span>{' '}
      {isFile ? <span className="bp5-text-disabled">{entry.name}</span> : entry.name}
    </span>;
  }
  if (entry.reference) {
    return <span>
      {entry.name} <span className="bp5-text-muted">-{'>'}</span>{' '}
      <Icon icon={(entry.reference.icon || 'circle') as any} size={12} />{' '}
      {entry.reference.name}
    </span>;
  }
  return isFile ? <span className="bp5-text-disabled">{entry.name}</span> : <span>{entry.name}</span>;
}

const LibraryEntryView = ({ entry }: { entry: LibraryEntryData }) => {
  const icon = entry.icon || 'circle';
  const entryForTab: Entry = {
    type: 'library',
    name: entry.name,
    icon: icon,
    reference: entry.reference,
    snippet: entry.snippet,
  };
  return (
    <SelectableEntry entry={entryForTab}>
      <Row middle="xs" className="child-pr-3">
        <Icon icon={icon as any} size={14} />
        <EntryName entry={entryForTab} />
      </Row>
      {entry.snippet && <Snippet text={entry.snippet} />}
    </SelectableEntry>
  );
}

const LibrariesView = ({ data }: { data: LibrariesGroup }) => <>
  <Row middle="xs" className="child-pr-3">
    <Icon icon="git-repo" size={14} />
    <span>Libraries{data.count !== undefined && <span className="bp5-text-muted"> ({data.count.toLocaleString()})</span>}</span>
  </Row>
  <div className="pl-8">
    {data.entries.map((entry, i) =>
      <LibraryEntryView key={i} entry={entry} />
    )}
  </div>
</>

const EntryView = ({ entry, defaultLanguage, isTopLevel }: { entry: Entry; defaultLanguage?: LanguageRef; isTopLevel?: boolean }) => {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedLangName, setSelectedLangName] = useState<string | null>(null);

  const hasVersions = entry.versions && entry.versions.length > 0;
  const entryLang = entry.language || defaultLanguage;
  const isFile = entry.type === 'file';
  const isLibrary = entry.type === 'library';
  const defaultIcon = isLibrary ? 'git-repo' : 'circle';
  const icon = entry.icon || defaultIcon;

  // Group this entry's versions by tag, dedup languages within each tag
  const tagGroups = useMemo(() => {
    if (!hasVersions) return [];
    const groups: { tag: string; langs: { name: string; icon: string }[] }[] = [];
    const tagMap = new Map<string, { name: string; icon: string }[]>();
    for (const v of entry.versions!) {
      const lang = resolveLanguage(v.language, entryLang);
      if (!tagMap.has(v.tag)) {
        const arr: { name: string; icon: string }[] = [];
        tagMap.set(v.tag, arr);
        groups.push({ tag: v.tag, langs: arr });
      }
      const arr = tagMap.get(v.tag)!;
      if (!arr.some(l => l.name === lang.name)) {
        arr.push(lang);
      }
    }
    return groups;
  }, [entry.versions, entryLang, hasVersions]);

  // Resolve current selection with fallbacks
  const currentTag = selectedTag && tagGroups.some(g => g.tag === selectedTag)
    ? selectedTag : (tagGroups[0]?.tag || '');
  const currentGroup = tagGroups.find(g => g.tag === currentTag);
  const defaultLangOption = currentGroup?.langs[0];
  const currentLangName = (selectedLangName && currentGroup?.langs.some(l => l.name === selectedLangName))
    ? selectedLangName : defaultLangOption?.name || '';
  const currentLang = currentGroup?.langs.find(l => l.name === currentLangName) || defaultLangOption || { name: '', icon: 'circle' };

  // Find the selected version object (matching tag + language)
  const selectedVersion = useMemo(() => {
    if (!hasVersions) return null;
    return entry.versions!.find(v => {
      const lang = resolveLanguage(v.language, entryLang);
      return v.tag === currentTag && lang.name === currentLangName;
    }) || entry.versions![0];
  }, [entry.versions, currentTag, currentLangName, entryLang, hasVersions]);

  // Languages available for the current tag on this entry
  const langsForCurrentTag = currentGroup?.langs || [];

  const nameElement = isTopLevel
    ? <h3>{entry.name}</h3>
    : <EntryName entry={entry} />;

  return <>
    <SelectableEntry entry={entry}>
      <Row middle="xs" between="xs">
        {hasVersions ? (
          <>
            <Row middle="xs" className="child-pr-3 pl-3" style={{flex: '1 1 auto'}}>
              <Icon icon={icon as any} size={isTopLevel ? 16 : 14} />
              {nameElement}
            </Row>
            <Col onClick={e => e.stopPropagation()}>
              <Row>
                <Button minimal><Icon icon="add" intent="success" size={16}/></Button>
                <Col>
                  <Row center="xs">
                    <Popover
                      content={
                        <Menu>
                          {tagGroups.map(({ tag, langs }) => (
                            <MenuItem
                              key={tag}
                              text={tag}
                              icon="git-branch"
                              active={tag === currentTag}
                              labelElement={
                                <span style={{display: 'flex', gap: '4px'}}>
                                  {langs.map(lang => (
                                    <Tag
                                      key={lang.name}
                                      minimal
                                      round
                                      interactive
                                      icon={<Icon icon={lang.icon as any} size={10} />}
                                      intent={tag === currentTag && lang.name === currentLangName ? 'primary' : 'none'}
                                      onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        setSelectedTag(tag);
                                        setSelectedLangName(lang.name);
                                      }}
                                    >
                                      {lang.name}
                                    </Tag>
                                  ))}
                                </span>
                              }
                              onClick={() => setSelectedTag(tag)}
                            />
                          ))}
                        </Menu>
                      }
                      placement="bottom-start"
                      minimal
                    >
                      <Button minimal className="pb-0">
                        <Row center="xs" middle="xs" className="bp5-text-muted">
                          <Icon icon="git-branch" className="pr-3" size={12}/>
                          <h5>{currentTag}</h5>
                          <Icon icon="caret-down" />
                        </Row>
                      </Button>
                    </Popover>
                  </Row>
                  <Row center="xs" middle="xs">
                    <Popover
                      content={
                        <Menu>
                          <MenuItem
                            text={currentTag}
                            icon="git-branch"
                            active
                            labelElement={
                              <span style={{display: 'flex', gap: '4px'}}>
                                {langsForCurrentTag.map(lang => (
                                  <Tag
                                    key={lang.name}
                                    minimal
                                    round
                                    interactive
                                    icon={<Icon icon={lang.icon as any} size={10} />}
                                    intent={lang.name === currentLangName ? 'primary' : 'none'}
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      setSelectedLangName(lang.name);
                                    }}
                                  >
                                    {lang.name}
                                  </Tag>
                                ))}
                              </span>
                            }
                          />
                        </Menu>
                      }
                      placement="bottom-start"
                      minimal
                    >
                      <Button minimal style={{fontSize: '10px', height: '100%'}}
                        icon={<Icon icon={currentLang.icon as any} size={10} />}
                        className="p-0">
                        {currentLang.name}
                        <Icon icon="caret-down" size={10} />
                      </Button>
                    </Popover>
                  </Row>
                </Col>
              </Row>
            </Col>
          </>
        ) : (
          <Row middle="xs" className="child-pr-3 pl-3" style={{flex: '1 1 auto'}}>
            <Icon icon={icon as any} size={isTopLevel ? 16 : 14} className={isFile ? "bp5-text-disabled" : undefined} />
            {nameElement}
          </Row>
        )}
      </Row>
      {entry.snippet && <Snippet text={entry.snippet} />}
    </SelectableEntry>
    {selectedVersion?.children && selectedVersion.children.length > 0 &&
      <div className="pl-8">
        {selectedVersion.children.map((child, i) =>
          child.type === 'libraries'
            ? <LibrariesView key={i} data={child as LibrariesGroup} />
            : <EntryView key={i} entry={child as Entry} defaultLanguage={entryLang} />
        )}
      </div>
    }
  </>;
}

const ProjectList = ({ projects }: { projects: Entry[] }) => <>
  {projects.map((project, i) =>
    <EntryView key={i} entry={project} isTopLevel />
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
  const layoutRef = useRef<IDELayoutHandle>(null);
  const [dynamicPanels, setDynamicPanels] = useState<PanelDefinition[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const lastSelectedKeyRef = useRef<string | null>(null);

  const onSelect = useCallback((key: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedKeys(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      lastSelectedKeyRef.current = key;
    } else if (e.shiftKey && lastSelectedKeyRef.current) {
      const allEls = Array.from(document.querySelectorAll('[data-entry-key]'));
      const allKeys = allEls.map(el => el.getAttribute('data-entry-key')!);
      const startIdx = allKeys.indexOf(lastSelectedKeyRef.current);
      const endIdx = allKeys.indexOf(key);
      if (startIdx !== -1 && endIdx !== -1) {
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const rangeKeys = allKeys.slice(from, to + 1);
        setSelectedKeys(prev => {
          const next = new Set(prev);
          rangeKeys.forEach(k => next.add(k));
          return next;
        });
      }
    } else {
      setSelectedKeys(new Set([key]));
      lastSelectedKeyRef.current = key;
    }
  }, []);

  const selectionState = useMemo(() => ({ selectedKeys, onSelect }), [selectedKeys, onSelect]);

  const profile: TProfile = {
    external: [
      { organization: ORGANIZATIONS.discord, display: 'discord.orbitmines.com', link: 'https://discord.orbitmines.com' },
      { organization: ORGANIZATIONS.github, display: 'orbitmines', link: 'https://github.com/orbitmines/ray/tree/main/Ether/library' },
    ]
  }

  const openEntry = useCallback((entry: Entry) => {
    const panelId = entry.library
      ? `entry-${entry.library}-${entry.name}`
      : entry.reference
        ? `entry-${entry.name}-${entry.reference.name}`
        : `entry-${entry.name}`;

    // Check if panel already registered, if not add it
    setDynamicPanels(prev => {
      if (prev.some(p => p.id === panelId)) return prev;
      const isLibrary = entry.type === 'library';
      const defaultIcon = isLibrary ? 'git-repo' : 'circle';
      return [...prev, {
        id: panelId,
        title: <EntryName entry={entry} />,
        icon: entry.icon || defaultIcon,
        render: () => <EntryView entry={entry} isTopLevel />,
      }];
    });

    // Use setTimeout to ensure panel is registered before adding to layout
    setTimeout(() => {
      layoutRef.current?.addPanelToLargestGroup(panelId);
    }, 0);
  }, []);

  const staticPanels = useMemo<PanelDefinition[]>(() => [
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

  const allPanels = useMemo<PanelDefinition[]>(
    () => [...staticPanels, ...dynamicPanels],
    [staticPanels, dynamicPanels]
  );

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
        <SelectionContext.Provider value={selectionState}>
          <OpenEntryContext.Provider value={openEntry}>
            <IDELayout ref={layoutRef} panels={allPanels} initialLayout={initialLayout} />
          </OpenEntryContext.Provider>
        </SelectionContext.Provider>
      </div>
    </Row>
  </Row>
};

export default Library;
