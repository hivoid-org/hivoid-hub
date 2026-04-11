import os
import shutil

def clean_pycache(root_path="."):
    """Recursively deletes all __pycache__ directories and .pyc/.pyo files."""
    deleted_dirs = 0
    deleted_files = 0
    
    for root, dirs, files in os.walk(root_path):
        # 1. Remove __pycache__ directories
        if "__pycache__" in dirs:
            pycache_path = os.path.join(root, "__pycache__")
            try:
                shutil.rmtree(pycache_path)
                print(f"✅ Removed directory: {pycache_path}")
                deleted_dirs += 1
            except Exception as e:
                print(f"❌ Error removing {pycache_path}: {e}")
        
        # 2. Remove .pyc and .pyo files
        for file in files:
            if file.endswith((".pyc", ".pyo")):
                file_path = os.path.join(root, file)
                try:
                    os.remove(file_path)
                    print(f"✅ Removed file: {file_path}")
                    deleted_files += 1
                except Exception as e:
                    print(f"❌ Error removing {file_path}: {e}")

    print(f"\n✨ Cleanup finished. Deleted {deleted_dirs} directories and {deleted_files} files.")

if __name__ == "__main__":
    # Clean from the directory where the script is located
    current_dir = os.getcwd()
    print(f"🚀 Starting cleanup in: {current_dir}")
    clean_pycache(current_dir)
