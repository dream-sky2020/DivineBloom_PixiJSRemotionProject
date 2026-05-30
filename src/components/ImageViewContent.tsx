import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

interface ImageViewContentProps {
  url: string;
  title?: string;
}

export const ImageViewContent: React.FC<ImageViewContentProps> = ({ url, title }) => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '20px 0',
      minHeight: '300px'
    }}>
      <div style={{
        maxWidth: '100%',
        maxHeight: '70vh',
        overflow: 'auto',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        background: 'var(--dark-navy)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <img 
          src={url} 
          alt={title || 'Preview'} 
          style={{ 
            maxWidth: '100%', 
            height: 'auto',
            display: 'block'
          }} 
        />
      </div>
      {title && (
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ color: 'var(--pale-blue)' }}>{title}</Text>
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>{url}</Text>
      </div>
    </div>
  );
};
