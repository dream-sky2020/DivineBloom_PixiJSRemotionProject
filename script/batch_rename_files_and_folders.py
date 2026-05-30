import os
import time
from pathlib import Path

def batch_rename_files_and_folders(target_dir, old_str, new_str):
    """
    深度优先批量替换指定路径下所有文件和文件夹名称中的特定字符串。
    """
    target_path = Path(target_dir).resolve()
    
    if not target_path.exists():
        print(f"错误：找不到路径 '{target_path}'")
        return

    print(f"开始全深度扫描: {target_path}")
    print("-" * 50)

    # 1. 收集所有需要处理的项目（包括子目录下的所有内容）
    all_items = []
    try:
        # rglob('*') 会递归查找所有文件和文件夹
        for item in target_path.rglob('*'):
            all_items.append(item)
    except Exception as e:
        print(f"扫描出错: {e}")
        return

    # 2. 将目标根目录也加入列表（如果根目录也需要重命名）
    all_items.append(target_path)

    # 3. 核心逻辑：按路径深度（层级）倒序排序
    # 这样可以确保：先重命名最深层的文件/文件夹，再重命名它们的父文件夹
    # 这样父文件夹重命名后，不会导致子项的旧路径失效
    all_items.sort(key=lambda x: len(x.parts), reverse=True)

    count_success = 0
    count_fail = 0

    for item in all_items:
        if old_str in item.name:
            new_name = item.name.replace(old_str, new_str)
            new_item_path = item.with_name(new_name)
            
            item_type = "文件夹" if item.is_dir() else "文件"
            
            # Windows 占用重试机制
            success = False
            for i in range(3):
                try:
                    # 使用 os.rename
                    os.rename(str(item), str(new_item_path))
                    print(f"[{item_type}] 成功: {item.name} -> {new_name}")
                    success = True
                    count_success += 1
                    break
                except PermissionError:
                    if i < 2:
                        print(f"[{item_type}] 占用中，等待重试... {item.name}")
                        time.sleep(1)
                    else:
                        print(f"[{item_type}] 失败 (拒绝访问/被占用): {item.name}")
                        count_fail += 1
                except Exception as e:
                    print(f"[{item_type}] 错误 {item.name}: {e}")
                    count_fail += 1
                    break

    print("-" * 50)
    print(f"任务完成！成功: {count_success}, 失败: {count_fail}")


if __name__ == "__main__":
    # ================= 配置区域 =================
    # 仅用于本地直接运行测试
    directory_path = r"D:\DivineBloom_PixiJSRemotionProject\public\image\家主宝" 
    old_string = "家主宝"
    new_string = "君主宝"
    # ===========================================
    
    batch_rename_files_and_folders(directory_path, old_string, new_string)
