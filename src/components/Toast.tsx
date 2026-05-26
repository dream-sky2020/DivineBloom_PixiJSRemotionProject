import type { FC } from 'react';
import { App } from 'antd';

interface ToastOptions {
  duration?: number;
  description?: string;
  placement?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
}

let messageApi: any = null;
let notificationApi: any = null;
const NOTIFICATION_CLASSNAME = 'app-notification';

export const ToastInit: FC = () => {
  const { message: antdMessage, notification: antdNotification } = App.useApp();
  messageApi = antdMessage;
  notificationApi = antdNotification;
  return null;
};

export const toast = {
  success: (content: string, options?: ToastOptions) => {
    if (options?.description) {
      notificationApi?.success({
        message: content,
        description: options.description,
        duration: options.duration,
        placement: options.placement || 'topRight',
        className: NOTIFICATION_CLASSNAME,
      });
    } else {
      messageApi?.success(content, options?.duration);
    }
  },

  error: (content: string, options?: ToastOptions) => {
    if (options?.description) {
      notificationApi?.error({
        message: content,
        description: options.description,
        duration: options.duration || 0,
        placement: options.placement || 'topRight',
        className: NOTIFICATION_CLASSNAME,
      });
    } else {
      messageApi?.error(content, options?.duration || 4);
    }
  },

  info: (content: string, options?: ToastOptions) => {
    if (options?.description) {
      notificationApi?.info({
        message: content,
        description: options.description,
        duration: options.duration,
        placement: options.placement || 'topRight',
        className: NOTIFICATION_CLASSNAME,
      });
    } else {
      messageApi?.info(content, options?.duration);
    }
  },

  warning: (content: string, options?: ToastOptions) => {
    if (options?.description) {
      notificationApi?.warning({
        message: content,
        description: options.description,
        duration: options.duration,
        placement: options.placement || 'topRight',
        className: NOTIFICATION_CLASSNAME,
      });
    } else {
      messageApi?.warning(content, options?.duration);
    }
  },
};
