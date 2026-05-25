import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import './DslEditor.css';

interface DslEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const DslEditor: React.FC<DslEditorProps> = ({
  value,
  onChange,
  placeholder = '请输入 DSL 脚本...'
}) => {
  return (
    <div className="dsl-editor-container">
      <div className="dsl-editor-main">
        <CodeMirror
          value={value}
          height="400px"
          theme={vscodeDark}
          extensions={[javascript()]}
          onChange={(val) => onChange(val)}
          placeholder={placeholder}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
          }}
        />
      </div>
    </div>
  );
};
