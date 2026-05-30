import { useState } from 'react';
import { Card, Input, Button, Space, Typography, Form, message, Divider } from 'antd';
import { FolderOpenOutlined, RocketOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const FILE_SERVER_URL = 'http://127.0.0.1:8787';

export function PythonToolsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);

  const handlePickDir = async () => {
    setPicking(true);
    try {
      const response = await fetch(`${FILE_SERVER_URL}/file/pick-dir`);
      const result = await response.json();
      if (result.ok && result.path) {
        form.setFieldsValue({ target_dir: result.path });
        message.success(`已选择目录: ${result.path}`);
      } else if (result.ok && !result.path) {
        // 用户取消了选择
        console.log('User cancelled directory picking');
      } else {
        message.error(`选择失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('Pick directory failed:', error);
      message.error('无法连接到本地服务器，请确保 server.py 已启动');
    } finally {
      setPicking(false);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const response = await fetch(`${FILE_SERVER_URL}/tool/batch-rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (result.ok) {
        message.success('批量重命名完成！');
      } else {
        message.error(`执行失败: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Batch rename failed:', error);
      message.error(`请求失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <section className="hero">
        <p className="eyebrow">Python Utilities</p>
        <Title level={1}>Python 工具使用</Title>
        <Paragraph className="summary">
          调用本地 Python 脚本处理文件和资源。这些工具直接操作您的本地文件系统。
        </Paragraph>
      </section>

      <section className="stage-card">
        <Card title="批量重命名文件与文件夹" variant="borderless">
          <Paragraph>
            此工具可以递归地替换指定目录下所有文件和文件夹名称中的特定字符串。
          </Paragraph>
          
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ old_str: '家主宝', new_str: '君主宝' }}
          >
            <Form.Item
              label="目标文件夹路径"
              required
            >
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item
                  name="target_dir"
                  noStyle
                  rules={[{ required: true, message: '请选择或输入目标文件夹路径' }]}
                >
                  <Input placeholder="例如: D:\Assets\Images" style={{ width: 'calc(100% - 100px)' }} />
                </Form.Item>
                <Button 
                  icon={<FolderOpenOutlined />} 
                  onClick={handlePickDir}
                  loading={picking}
                  style={{ width: '100px' }}
                >
                  选择
                </Button>
              </Space.Compact>
            </Form.Item>

            <div style={{ display: 'flex', gap: '16px' }}>
              <Form.Item
                label="查找字符串 (Old String)"
                name="old_str"
                rules={[{ required: true, message: '请输入要查找的字符串' }]}
                style={{ flex: 1 }}
              >
                <Input placeholder="需要被替换的旧名称" />
              </Form.Item>

              <Form.Item
                label="替换为 (New String)"
                name="new_str"
                rules={[{ required: true, message: '请输入替换后的字符串' }]}
                style={{ flex: 1 }}
              >
                <Input placeholder="替换后的新名称" />
              </Form.Item>
            </div>

            <Divider />

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<RocketOutlined />} 
                loading={loading}
                size="large"
                block
              >
                开始执行批量重命名
              </Button>
            </Form.Item>
          </Form>

          <div style={{ marginTop: '16px', padding: '12px', background: 'var(--dark-navy)', borderRadius: '8px' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              注意：此操作不可撤销，请在执行前确保已备份重要数据。
            </Text>
          </div>
        </Card>
      </section>
    </div>
  );
}
