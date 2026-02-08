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

const Language = ({children}: Children) => {
  return <>
    <Button minimal className="p-0" style={{minWidth: '0', flex: '1 1 auto', justifyContent: 'left'}}>
      <Row middle="xs" className="child-pr-3">
        {children}
      </Row>
    </Button>
    <Col>
      <Row>
        <Button minimal><Icon icon="add" intent="success" size={16}/></Button>
        <Col>
          <Row center="xs">
            <Button minimal className="pb-0">
              <Row center="xs" middle="xs" className="bp5-text-muted">
                <Icon icon="git-branch" className="pr-3" size={12}/><h5>v1.0.0</h5><Icon icon="caret-down" />
              </Row>
            </Button>
          </Row>
          <Row center="xs" middle="xs">
            <Button minimal style={{fontSize: '10px', height: '100%'}} icon={<Icon icon="circle" size={10} />} className="p-0">
              Language
            </Button>
          </Row>
        </Col>
      </Row>
    </Col>
  </>
}

const ProjectList = () => <>
  <Row middle="xs" between="xs">
    <Language>
      <Icon icon="circle" size={16} />
      <h3>Ray</h3>
    </Language>
  </Row>
  <Row>
    <Col xs={12} className="pl-8">
      <Row middle="xs" className="child-pr-3"><Icon icon="document" size={14} className="bp5-text-disabled" /><span className="bp5-text-disabled">UUID.ray</span></Row>
      <Block style={{width: '100%', fontSize: '12px', padding: '10px', margin: '5px'}}>UUID: UUID("asadasdasdasdasdddaaaaaaaaaaaaa"</Block>

      <Row middle="xs" className="child-pr-3"><Icon icon="git-repo" size={14} /><span>Libraries <span className="bp5-text-muted">(10,000)</span></span></Row>

      <Row className="pl-8">
        <Row middle="xs" className="child-pr-3"><Icon icon="circle" size={14} />Library</Row>
        <Block style={{width: '100%', fontSize: '12px', padding: '10px', margin: '5px'}}>UUID: UUID("asadasdasdasdasdddaaaaaaaaaaaaa"</Block>
        <Row middle="xs" className="child-pr-3"><Icon icon="circle" size={14} /><span>Library <span className="bp5-text-muted">-{'>'}</span></span><Icon icon="circle" size={14} />Language</Row>
        <Block style={{width: '100%', fontSize: '12px', padding: '10px', margin: '5px'}}>UUID: UUID("asadasdasdasdasdddaaaaaaaaaaaaa"</Block>
      </Row>

    </Col>
  </Row>

  <Row middle="xs" between="xs">
    <Button minimal className="p-0" style={{minWidth: '0', flex: '1 1 auto', justifyContent: 'left'}}>
      <Row middle="xs" className="child-pr-3">
        <Icon icon="circle" size={16} />
        <h3>Set Theory</h3>
      </Row>
    </Button>
    {/*<Button minimal>*/}
    {/*  <Row middle="xs" className="bp5-text-muted">*/}
    {/*    <Icon icon="git-branch" className="pr-3" size={12}/><h5>v1.0.0</h5><Icon icon="caret-down" />*/}
    {/*  </Row>*/}
    {/*</Button>*/}
  </Row>
  <Row>
    <Col xs={12} className="p-0 pl-8">
      <Row><Language><Icon icon="circle" size={14} /><span>set.mm</span></Language></Row>
      <Block style={{width: '100%', fontSize: '12px', padding: '10px', margin: '5px'}}>UUID: UUID("asadasdasdasdasdddaaaaaaaaaaaaa"</Block>
    </Col>
  </Row>
  <Row middle="xs" between="xs">
    <Language>
      <Icon icon="circle" size={16} />
      <h3>UUID</h3>
    </Language>
  {/* No implementation language; or English, but versioned. */}
  </Row>
  <Row>
    {/* Version of file / class. */}
    <Col xs={12} className="p-0 pl-8">
      <Row><Language><Icon icon="circle" size={14} /><span>Ray // UUID.ray</span></Language></Row>
      <Block style={{width: '100%', fontSize: '12px', padding: '10px', margin: '5px'}}>UUID: UUID("asadasdasdasdasdddaaaaaaaaaaaaa"</Block>
    </Col>
  </Row>
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
      <ProjectList/>
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
      render: () => <ProjectList />,
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
