import Post, {Arc, BR, Col, HorizontalLine, PaperProps, Row, Section} from "./Post";
import React, {useEffect, useRef} from "react";
import {useSearchParams} from "react-router-dom";
import {Button} from "@blueprintjs/core";

type Snippet = { before: string; match: string; after: string };
type SearchResult = { sectionName: string; snippets: Snippet[] };

const extractText = (node: React.ReactNode): string => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (!React.isValidElement(node)) return '';
  if (node.type === Section) return '';
  if (node.type === BR) return '\n';
  const children = (node.props as any)?.children;
  if (children) return extractText(children);
  return '';
};

export class BookUtil {
  constructor(private props: PaperProps, private params: URLSearchParams) {}

  arcs = () => React.Children.toArray(this.props.children).filter(child =>
    React.isValidElement(child) && child.type === Arc
  )

  getSections = (node: React.ReactNode): React.ReactElement[] => {
    if (!React.isValidElement(node)) return [];

    const children = React.Children.toArray(node.props?.children);

    const directSections = children.filter(
      child => React.isValidElement(child) && child.type === Section && child.props.head
    ) as React.ReactElement[];

    return directSections.flatMap(section => [
      section,
      ...this.getSections(section)
    ]);
  };

  current = (): any => {
    const current = this.allSections().filter(child => this.sectionName(child) === this.section());

    return current.length != 0 ? current[0] : this.allSections()[0]
  }

  allSections = () =>
    this.arcs().flatMap(arc => [
      arc,
      ...this.getSections(arc)
    ]).filter(child => !this.disabled(child));

  section = () => this.params.get('section')

  firstSection = () => this.sectionName(this.allSections()[0])
  previousSection = () => this.nextSection(true)
  nextSection = (reverse: boolean = false) => this.sectionName(this.next(reverse))

  sectionName = (element: any) => {
    if (typeof element.props.head === "string") return element.props.head
    if (element.props.head.props != undefined) return element.props.head.props.children
    return ""
  }
  disabled = (element: any) => typeof element.props.head !== "string"

  previous = () => this.next(true)
  next = (reverse: boolean = false) => {
    const sections = this.allSections()
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]
      if (!this.isSelected(section)) continue

      if (reverse) {
        if (i === 0) return undefined
      } else {
        if (i === sections.length - 1) return undefined
      }

      return sections[i + (reverse ? -1 : 1)] as any
    }

    return undefined
  }

  isSelected = (element: any) => {
    return React.isValidElement(element) && this.sectionName(element) === this.section();
  }

  getContentChildren = (element: any): React.ReactNode[] =>
    React.Children.toArray(element.props.children)
      .filter((child: any) => !React.isValidElement(child) || child.type !== Section);

  searchAll = (query: string): SearchResult[] => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const section of this.allSections()) {
      const content = this.getContentChildren(section);
      const text = content.map(extractText).join(' ');
      const lowerText = text.toLowerCase();

      const snippets: Snippet[] = [];
      let startFrom = 0;
      while (true) {
        const idx = lowerText.indexOf(lowerQuery, startFrom);
        if (idx === -1) break;

        const before = text.slice(Math.max(0, idx - 80), idx);
        const match = text.slice(idx, idx + query.length);
        const after = text.slice(idx + query.length, idx + query.length + 80);
        snippets.push({
          before: (idx > 80 ? '...' : '') + before,
          match,
          after: after + (idx + query.length + 80 < text.length ? '...' : '')
        });
        startFrom = idx + query.length;
      }

      if (snippets.length > 0) {
        results.push({ sectionName: this.sectionName(section), snippets });
      }
    }
    return results;
  };
}

export const Navigation = (props: PaperProps) => {
  const [params, setParams] = useSearchParams();

  const util = new BookUtil(props, params)

  return <Row style={{height: '100%', borderRight: '1px solid rgb(108, 103, 131)', alignContent: 'flex-start'}} className="pl-10 child-py-3 py-20">
    {util.arcs().map((arc: any) => <Col xs={12} style={{textAlign: 'start'}}>
      <a className="bp5-text-muted" style={{color: util.isSelected(arc) ? 'orange' : '#abb3bf'}} onClick={() => !util.disabled(arc) ? setParams(prev => { const next = new URLSearchParams(prev); next.set('section', util.sectionName(arc)); next.delete('search'); return next; }) : undefined}>{arc.props.head}</a>

      {React.Children.toArray((arc as any).props.children).filter(child =>
        React.isValidElement(child) && child.type === Section
      ).map((section: any) => <Col xs={12} style={{textAlign: 'start'}} className="pt-3">
        <a className="bp5-text-muted ml-5" style={util.isSelected(section) ? {color: 'orange'} : {}} onClick={() => !util.disabled(section) ? setParams(prev => { const next = new URLSearchParams(prev); next.set('section', util.sectionName(section)); next.delete('search'); return next; }) : undefined}>{section.props.head}</a>

        {React.Children.toArray((section as any).props.children).filter(child =>
          React.isValidElement(child) && child.type === Section
        ).map((section: any) => <Col xs={12} style={{textAlign: 'start'}}>
          <a className="bp5-text-muted ml-10" style={util.isSelected(section) ? {color: 'orange'} : {}} onClick={() => !util.disabled(section) ? setParams(prev => { const next = new URLSearchParams(prev); next.set('section', util.sectionName(section)); next.delete('search'); return next; }) : undefined}>{section.props.head}</a>


        </Col>)}
      </Col>)}
    </Col>)}
  </Row>
}

const BookSearch = ({ props, params, setParams, onBack }: {
  props: PaperProps,
  params: URLSearchParams,
  setParams: ReturnType<typeof useSearchParams>[1],
  onBack: () => void
}) => {
  const search = params.get('search') || '';
  const util = new BookUtil(props, params);
  const results = util.searchAll(search);
  const totalSnippets = results.reduce((sum, r) => sum + r.snippets.length, 0);

  return <Row>
    <Col xs={12}>
      <Row between="xs" middle="xs" className="pb-10">
        <Button icon="arrow-left" text="Back" minimal style={{fontSize: '16px'}} onClick={onBack} />
        <span className="bp5-text-muted" style={{fontSize: '14px'}}>
          {totalSnippets} result{totalSnippets !== 1 ? 's' : ''} for '{search}'
        </span>
      </Row>
    </Col>
    {results.length === 0 ? <Col xs={12}>
      <Row center="xs" className="py-20">
        <span className="bp5-text-muted" style={{fontSize: '16px'}}>No results found.</span>
      </Row>
    </Col> : results.map((result, ri) => <Col xs={12} key={ri} className="pb-10">
      <div className="bp5-text-muted" style={{fontSize: '13px', paddingBottom: '4px'}}>{result.sectionName}</div>
      {result.snippets.map((snippet, si) => <div key={si} style={{
        padding: '8px 12px',
        marginBottom: '6px',
        borderLeft: '2px solid rgba(255, 179, 71, 0.4)',
        fontSize: '14px',
        lineHeight: '1.6'
      }}>
        <span style={{whiteSpace: 'pre-wrap'}}>
          {snippet.before}<mark style={{
            backgroundColor: 'rgba(255, 179, 71, 0.3)',
            color: 'inherit',
            padding: '1px 2px',
            borderRadius: '2px'
          }}>{snippet.match}</mark>{snippet.after}
        </span>
        <div style={{paddingTop: '4px'}}>
          <Button
            rightIcon="arrow-right"
            text="Keep reading"
            minimal
            small
            style={{fontSize: '13px'}}
            onClick={() => setParams(prev => {
              const next = new URLSearchParams(prev);
              next.set('section', result.sectionName);
              next.set('highlight', search);
              next.delete('search');
              return next;
            })}
          />
        </div>
      </div>)}
    </Col>)}
  </Row>;
};

const Book = (props: PaperProps) => {
  const [params, setParams] = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);
  const preSearchState = useRef<{ section: string | null; scrollTop: number } | null>(null);
  const prevSearch = useRef<string | null>(null);

  const section = params.get('section');
  const search = params.get('search');
  const highlight = params.get('highlight');

  // Save state when entering search
  useEffect(() => {
    const wasSearching = (prevSearch.current ?? '').length > 0;
    const isSearching = (search ?? '').length > 0;

    if (!wasSearching && isSearching) {
      preSearchState.current = {
        section: params.get('section'),
        scrollTop: document.documentElement.scrollTop
      };
    }

    prevSearch.current = search;
  }, [search]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();

        const input = document.getElementById("search") as HTMLInputElement;
        input?.focus();
        input?.select();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Highlight text when navigating from search
  useEffect(() => {
    if (!highlight || !contentRef.current) return;

    const timer = setTimeout(() => {
      const walker = document.createTreeWalker(
        contentRef.current!,
        NodeFilter.SHOW_TEXT,
        null
      );

      const lowerHighlight = highlight.toLowerCase();
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const idx = node.textContent?.toLowerCase().indexOf(lowerHighlight) ?? -1;
        if (idx === -1) continue;

        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + highlight.length);

        const mark = document.createElement('mark');
        mark.style.backgroundColor = 'rgba(255, 179, 71, 0.4)';
        mark.style.color = 'inherit';
        mark.style.padding = '1px 2px';
        mark.style.borderRadius = '2px';
        range.surroundContents(mark);

        mark.scrollIntoView({ block: 'center', behavior: 'smooth' });

        setTimeout(() => {
          const parent = mark.parentNode;
          if (parent) {
            parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
            parent.normalize();
          }
          setParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete('highlight');
            return next;
          });
        }, 3000);

        break;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [highlight, section]);

  const isSearching = (search ?? '').length > 0;
  const isStartPage: boolean = (section ?? "").length == 0

  const util = new BookUtil(props, params)

  const handleBack = () => {
    const saved = preSearchState.current;
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('search');
      if (saved?.section) {
        next.set('section', saved.section);
      } else {
        next.delete('section');
      }
      return next;
    });
    if (saved) {
      requestAnimationFrame(() => {
        document.documentElement.scrollTop = saved.scrollTop;
      });
    }
    preSearchState.current = null;
  };

  if (isSearching)
    return <BookSearch props={props} params={params} setParams={setParams} onBack={handleBack} />;

  const current = util.current()

  if (isStartPage)
    return <Row end="xs">
      <Button rightIcon="arrow-right" text="Start Reading" minimal style={{fontSize: '18px'}} onClick={() => setParams(prev => { const next = new URLSearchParams(prev); next.set('section', util.firstSection()); return next; })} />
    </Row>

  return <Row>
    <Col xs={12}>
      <div ref={contentRef}>
        <Section head={current.props.head}>
          {React.Children.toArray(current.props.children).filter((child: any) => !React.isValidElement(child) || child.type !== Section)}
        </Section>
      </div>
    </Col>
    <Col xs={12}>
      <HorizontalLine/>
    </Col>
    <Col xs={12}>
      <Row between="xs">
        {util.previous() ? <Button icon="arrow-left" text={util.previousSection()} minimal style={{fontSize: '18px', maxWidth: '50%'}} onClick={() => setParams(prev => { const next = new URLSearchParams(prev); next.set('section', util.previousSection()); return next; })} /> : <div/>}
        {util.next() ? <Button rightIcon="arrow-right" text={util.nextSection()} minimal style={{fontSize: '18px', maxWidth: '50%'}} onClick={() => setParams(prev => { const next = new URLSearchParams(prev); next.set('section', util.nextSection()); return next; })} /> : null}
      </Row>
    </Col>
  </Row>
}

export default Book;