import React from 'react';
import Editor from '@monaco-editor/react';
import './DslEditor.css';

interface DslEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  schemaUrl?: string;
}

const RENDER_TAGS = [
  { label: 'Image', documentation: '单张图片渲染根容器' },
  { label: 'Video', documentation: '视频渲染根容器' },
  { label: 'FRAME', documentation: '定义单帧的摄像机和渲染对象' },
  { label: 'SPRITE', documentation: '基础图像渲染单元' },
  { label: 'PARTICLECONTAINER', documentation: '共享 atlas 的粒子容器' },
  { label: 'PARTICLE', documentation: '挂载在粒子容器下的单个粒子' },
];

const RENDER_ATTRIBUTES: Record<string, Array<{ label: string; documentation: string }>> = {
  IMAGE: [
    { label: 'name', documentation: '图片渲染任务名称' },
    { label: 'transparent', documentation: '是否使用透明背景，默认 false' },
  ],
  VIDEO: [
    { label: 'name', documentation: '视频渲染任务名称' },
    { label: 'fps', documentation: '每秒帧率' },
    { label: 'totalFrames', documentation: '总帧数' },
  ],
  FRAME: [
    { label: 'id', documentation: '帧索引/唯一标识' },
    { label: 'cameraX', documentation: '摄像机 X 轴偏移' },
    { label: 'cameraY', documentation: '摄像机 Y 轴偏移' },
  ],
  SPRITE: [
    { label: 'id', documentation: '精灵唯一标识' },
    { label: 'atlas', documentation: '合图资源 ID，与 frame 配合使用' },
    { label: 'frame', documentation: '合图中的分图名称' },
    { label: 'image', documentation: '单张图片路径，不能与 atlas/frame 同时使用' },
    { label: 'x', documentation: 'X 绝对坐标' },
    { label: 'y', documentation: 'Y 绝对坐标' },
    { label: 'anchorX', documentation: '中心锚点 X，默认 0.5' },
    { label: 'anchorY', documentation: '中心锚点 Y，默认 0.5' },
    { label: 'zIndex', documentation: '渲染层级，数值越大越靠前' },
    { label: 'scaleX', documentation: 'X 轴缩放，默认 1.0' },
    { label: 'scaleY', documentation: 'Y 轴缩放，默认 1.0' },
    { label: 'rotation', documentation: '旋转弧度，默认 0.0' },
    { label: 'alpha', documentation: '透明度，默认 1.0' },
    { label: 'visible', documentation: '是否可见，默认 true' },
    { label: 'blendMode', documentation: 'normal, add, multiply, screen, subtract, none' },
    { label: 'tint', documentation: '0xRRGGBB 十六进制染色值' },
  ],
  PARTICLECONTAINER: [
    { label: 'id', documentation: '容器唯一标识' },
    { label: 'atlas', documentation: '绑定的合图资源 ID' },
    { label: 'zIndex', documentation: '渲染层级，数值越大越靠前' },
    { label: 'blendMode', documentation: 'normal, add, multiply, screen, subtract, none' },
  ],
  PARTICLE: [
    { label: 'id', documentation: '粒子唯一标识' },
    { label: 'particleContainer', documentation: '所属粒子容器 ID' },
    { label: 'frame', documentation: '合图中的分图名称，资源继承自容器' },
    { label: 'x', documentation: '绝对坐标 X' },
    { label: 'y', documentation: '绝对坐标 Y' },
    { label: 'scaleX', documentation: 'X 轴缩放，默认 1.0' },
    { label: 'scaleY', documentation: 'Y 轴缩放，默认 1.0' },
    { label: 'anchorX', documentation: '中心锚点 X，默认 0.5' },
    { label: 'anchorY', documentation: '中心锚点 Y，默认 0.5' },
    { label: 'rotation', documentation: '旋转弧度，默认 0.0' },
    { label: 'alpha', documentation: '透明度，默认 1.0' },
    { label: 'tint', documentation: '0xRRGGBB 十六进制混合颜色' },
  ],
};

export const DslEditor: React.FC<DslEditorProps> = ({
  value,
  onChange,
  schemaUrl,
}) => {
  const handleEditorChange = (val: string | undefined) => {
    onChange(val || '');
  };

  const handleEditorWillMount = (monaco: any) => {
    // 注册自定义 XML 补全
    monaco.languages.registerCompletionItemProvider('xml', {
      triggerCharacters: ['<', ' ', '/'],
      provideCompletionItems: (model: any, position: any) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        // 判断是否在标签内
        const isTagAttribute = /<(\w+)\s+[^>]*$/.test(textUntilPosition);
        const tagMatch = textUntilPosition.match(/<(\w+)\s+[^>]*$/);

        if (isTagAttribute && tagMatch) {
          const tagName = tagMatch[1].toUpperCase();
          const attributes = RENDER_ATTRIBUTES[tagName] ?? [];

          return {
            suggestions: attributes.map(attr => ({
              label: attr.label,
              kind: monaco.languages.CompletionItemKind.Property,
              documentation: attr.documentation,
              insertText: `${attr.label}=""`,
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column,
                endColumn: position.column,
              },
            })),
          };
        }

        // 标签补全
        if (textUntilPosition.endsWith('<')) {
          return {
            suggestions: RENDER_TAGS.map(tag => ({
              label: tag.label,
              kind: monaco.languages.CompletionItemKind.Class,
              documentation: tag.documentation,
              insertText: tag.label,
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column,
                endColumn: position.column,
              },
            })),
          };
        }

        return { suggestions: [] };
      },
    });
  };

  return (
    <div className="dsl-editor-container">
      <div className="dsl-editor-toolbar">
        <span>DSL Editor (Monaco)</span>
        <span className="dsl-editor-hint">
          支持 XML 语法补全与属性提示{schemaUrl ? ` · Schema: ${schemaUrl}` : ''}
        </span>
      </div>
      <div className="dsl-editor-main">
        <Editor
          height="560px"
          defaultLanguage="xml"
          value={value}
          onChange={handleEditorChange}
          beforeMount={handleEditorWillMount}
          theme="vs-light"
          options={{
            fontSize: 14,
            fontFamily: "'Fira Code', 'Courier New', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
            bracketPairColorization: { enabled: true },
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
          }}
        />
      </div>
    </div>
  );
};
