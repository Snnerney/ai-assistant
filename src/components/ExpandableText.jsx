import React, { useState, useMemo, useEffect } from 'react';
import { Button } from 'antd';
import { marked } from 'marked';
import './ExpandableText.css';

function ExpandableText({ text = '', maxLines = 10 }) {
  const [expanded, setExpanded] = useState(false);

  const normalizedText = useMemo(() => (text || '').trim(), [text]);
  const lines = useMemo(() => (normalizedText ? normalizedText.split(/\r?\n/) : []), [normalizedText]);
  const needsCollapse = useMemo(() => lines.length > maxLines, [lines.length, maxLines]);
  
  const collapsedSource = useMemo(() => {
    if (!needsCollapse) return normalizedText;
    return lines.slice(0, maxLines).join('\n');
  }, [needsCollapse, normalizedText, lines, maxLines]);

  const renderSource = useMemo(() => {
    if (!normalizedText) return '—';
    if (normalizedText === '—') return '—';
    return expanded || !needsCollapse ? normalizedText : collapsedSource;
  }, [normalizedText, expanded, needsCollapse, collapsedSource]);

  const renderAsHtml = useMemo(() => renderSource !== '—', [renderSource]);

  const html = useMemo(() => {
    if (!renderAsHtml) return '';
    try {
      return marked.parse(renderSource);
    } catch (e) {
      return renderSource;
    }
  }, [renderAsHtml, renderSource]);

  // Reset expanded when text changes
  useEffect(() => {
    setExpanded(false);
  }, [text]);

  const toggle = () => {
    setExpanded(!expanded);
  };

  return (
    <div className="expandable-text">
      <div className="expandable-text__content">
        {!renderAsHtml ? (
          <div className="expandable-text__plain">{renderSource}</div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
      {needsCollapse && (
        <div className="expandable-text__actions">
          <Button type="link" size="small" onClick={toggle}>
            {expanded ? '收起' : '展开更多'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ExpandableText;
