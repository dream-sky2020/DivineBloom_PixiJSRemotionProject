import React from 'react';
import { App } from 'antd';
import { 
  ExclamationCircleOutlined, 
  QuestionCircleOutlined, 
  InfoCircleOutlined, 
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined
} from '@ant-design/icons';

interface DialogOptions {
  title: string;
  content: React.ReactNode;
  onOk?: () => void | Promise<any>;
  onCancel?: () => void;
  okText?: string;
  cancelText?: string;
  okType?: 'primary' | 'danger' | 'default';
  width?: number | string;
  centered?: boolean;
  maskClosable?: boolean;
}

// 这是一个单例引用，将在 App 组件初始化时被赋值
let modal: any = null;

/**
 * DialogsInit 组件：用于在 Ant Design 的 App 组件内部获取 modal 实例
 */
export const DialogsInit: React.FC = () => {
  const { modal: antdModal } = App.useApp();
  modal = antdModal;
  return null;
};

/**
 * 统一的 Dialogs 弹窗工具类
 */
export const dialogs = {
  confirm: (options: DialogOptions) => {
    if (!modal) {
      console.error('Dialogs not initialized. Make sure <DialogsInit /> is inside <App />');
      return;
    }
    modal.confirm({
      title: options.title,
      icon: <QuestionCircleOutlined style={{ color: 'var(--blue)' }} />,
      content: options.content,
      okText: options.okText || '确定',
      cancelText: options.cancelText || '取消',
      okButtonProps: {
        danger: options.okType === 'danger'
      },
      centered: options.centered ?? true,
      width: options.width,
      onOk: options.onOk,
      onCancel: options.onCancel,
      maskClosable: options.maskClosable ?? false,
    });
  },

  warning: (options: DialogOptions) => {
    if (!modal) return;
    modal.warning({
      title: options.title,
      icon: <ExclamationCircleOutlined style={{ color: 'var(--yellow)' }} />,
      content: options.content,
      okText: options.okText || '知道了',
      centered: options.centered ?? true,
      width: options.width,
      onOk: options.onOk,
      maskClosable: options.maskClosable ?? true,
    });
  },

  success: (options: DialogOptions) => {
    if (!modal) return;
    modal.success({
      title: options.title,
      icon: <CheckCircleOutlined style={{ color: 'var(--green)' }} />,
      content: options.content,
      okText: options.okText || '确定',
      centered: options.centered ?? true,
      width: options.width,
      onOk: options.onOk,
      maskClosable: options.maskClosable ?? true,
    });
  },

  error: (options: DialogOptions) => {
    if (!modal) return;
    modal.error({
      title: options.title,
      icon: <CloseCircleOutlined style={{ color: 'var(--red)' }} />,
      content: options.content,
      okText: options.okText || '确定',
      centered: options.centered ?? true,
      width: options.width,
      onOk: options.onOk,
      maskClosable: options.maskClosable ?? true,
    });
  },

  info: (options: DialogOptions) => {
    if (!modal) return;
    modal.info({
      title: options.title,
      icon: <InfoCircleOutlined style={{ color: 'var(--blue)' }} />,
      content: options.content,
      okText: options.okText || '确定',
      centered: options.centered ?? true,
      width: options.width,
      onOk: options.onOk,
      maskClosable: options.maskClosable ?? true,
    });
  },

  preview: (options: DialogOptions) => {
    if (!modal) return;
    modal.info({
      title: options.title,
      icon: <EyeOutlined style={{ color: 'var(--cyan)' }} />,
      content: options.content,
      okText: options.okText || '关闭',
      centered: options.centered ?? true,
      width: options.width || 800,
      onOk: options.onOk,
      maskClosable: options.maskClosable ?? true,
      footer: null, // 预览通常不需要底部按钮，或者只显示关闭
    });
  }
};
