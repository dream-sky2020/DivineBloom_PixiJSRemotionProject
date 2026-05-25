import os
import json

def load_custom_config(config_file):
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading custom config: {e}")
    return {}

def generate_manifest(public_dir, output_file, config_file):
    custom_config = load_custom_config(config_file)
    manifest = []
    
    # 支持的扩展名映射
    ext_map = {
        '.png': 'image',
        '.jpg': 'image',
        '.jpeg': 'image',
        '.svg': 'image',
        '.webp': 'image',
        '.json': 'json', # 可能是普通的 JSON 或 Spritesheet
        '.mp3': 'audio',
        '.wav': 'audio',
        '.mp4': 'video'
    }

    for root, dirs, files in os.walk(public_dir):
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in ext_map:
                # 计算相对于 public 的路径作为 URL
                rel_path = os.path.relpath(os.path.join(root, file), public_dir)
                url = '/' + rel_path.replace('\\', '/')
                
                # 生成默认 ID：去除扩展名，将路径分隔符替换为连字符
                default_id = os.path.splitext(rel_path)[0].replace('\\', '-').replace('/', '-')
                
                asset_type = ext_map[ext]
                
                # 特殊处理：如果 .json 文件同名存在 .png，则判定为 spritesheet
                if ext == '.json':
                    png_path = os.path.join(root, os.path.splitext(file)[0] + '.png')
                    if os.path.exists(png_path):
                        asset_type = 'spritesheet'

                # 获取自定义配置（别名和标签）
                # 使用相对路径作为配置的 Key，因为它是唯一的
                asset_key = rel_path.replace('\\', '/')
                config = custom_config.get(asset_key, {})
                
                asset_data = {
                    'id': config.get('alias', default_id),
                    'url': url,
                    'type': asset_type,
                    'path': asset_key # 保留原始路径作为标识
                }
                
                if 'tags' in config:
                    asset_data['tags'] = config['tags']
                
                manifest.append(asset_data)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    
    print(f"Manifest generated with {len(manifest)} assets at {output_file}")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public_path = os.path.join(base_dir, 'public')
    output_path = os.path.join(public_path, 'asset_manifest.json')
    config_path = os.path.join(public_path, 'asset_custom_config.json')
    
    if os.path.exists(public_path):
        generate_manifest(public_path, output_path, config_path)
    else:
        print(f"Error: public directory not found at {public_path}")
