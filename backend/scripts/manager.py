#!/usr/bin/env python3
import os
import sys
import secrets
import subprocess
from datetime import datetime
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.live import Live
from rich.text import Text
from rich.align import Align
from rich.prompt import Prompt, Confirm
from rich import box

# Standard paths
INSTALL_DIR = "/opt/hivoid-hub"
BACKEND_DIR = os.path.join(INSTALL_DIR, "backend")
sys.path.append(BACKEND_DIR)

try:
    from app.core.database import SessionLocal
    from app.models.base import AdminUser
    from app.core.auth import get_password_hash
    from app.core.hub_config import load_hub_config, save_hub_config
except ImportError:
    print("Error: Please run as root within the hub environment.")
    sys.exit(1)

console = Console()

class HiVoidManager:
    def __init__(self):
        self.service = "hivoid-hub"
        self.menu_items = [
            ("↺", "Restart HiVoid Service", "Force reload backend and core engine"),
            ("⏹", "Stop Hub Service", "Shutdown all hub operations"),
            ("▶", "Start Hub Service", "Initiate system boot"),
            ("🔑", "Reset Admin Password", "Securely update administrative credentials"),
            ("👤", "Change Admin Username", "Modify primary login identity"),
            ("🌐", "Update Hub Timezone", "Sync alerts to your local clock"),
            ("🛡", "Regenerate Master Token", "Rotate security keys for edge nodes"),
            ("⬆", "Update System", "Pull latest stable release from repository"),
            ("🔥", "Uninstall", "Completely remove HiVoid from this system"),
            ("❌", "Exit", "Close management console")
        ]
        self.idx = 0

    def get_service_badge(self, svc):
        try:
            out = subprocess.check_output(["systemctl", "is-active", svc], stderr=subprocess.DEVNULL).decode().strip()
            return "[bold green]ONLINE[/]" if out == "active" else "[bold red]OFFLINE[/]"
        except: return "[dim]N/A[/]"

    def draw_ui(self):
        from rich.console import Group
        # Header
        header = Text.assemble(
            ("\n  ██╗  ██╗██╗██╗   ██╗ ██████╗ ██╗██████╗ \n", "cyan bold"),
            ("  ██║  ██║██║██║   ██║██╔═══██╗██║██╔══██╗\n", "cyan bold"),
            ("  ███████║██║██║   ██║██║   ██║██║██║  ██║\n", "cyan bold"),
            ("  ██╔══██║██║╚██╗ ██╔╝██║   ██║██║██║  ██║\n", "cyan bold"),
            ("  ██║  ██║██║ ╚████╔╝ ╚██████╔╝██║██████╔╝\n", "cyan bold"),
            ("  ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═════╝ ╚═╝╚═════╝ \n", "cyan bold"),
        )

        # Status Bar
        status_table = Table(box=None, show_header=False, width=64, padding=(0, 2))
        status_table.add_column(justify="center")
        status_table.add_column(justify="center")
        status_table.add_column(justify="center")
        
        status_table.add_row(
            Text.assemble(("HUB: ", "dim"), Text.from_markup(self.get_service_badge(self.service))),
            Text.assemble(("SQL: ", "dim"), Text.from_markup(self.get_service_badge("postgresql"))),
            Text.assemble(("NGX: ", "dim"), Text.from_markup(self.get_service_badge("nginx")))
        )

        # Menu
        menu_table = Table(box=None, show_header=False, padding=(0, 2))
        for i, (icon, label, desc) in enumerate(self.menu_items):
            if i == self.idx:
                menu_table.add_row(
                    f"[bold blue]➤ {icon}[/]", 
                    f"[bold white on blue] {label.upper()} [/]",
                    f"[italic cyan]{desc}[/]"
                )
            else:
                menu_table.add_row(
                    f"  {icon}", 
                    f"[white]{label}[/]",
                    f"[dim]{desc}[/]"
                )

        content = Align.center(
            Panel(
                Align.center(menu_table),
                title=f"[white]MAIN CONTROL[/]",
                subtitle="[dim]ARROWS: NAVIGATE | ENTER: SELECT | Q: EXIT[/]",
                box=box.ROUNDED,
                padding=(1, 2)
            )
        )

        return Group(
            Align.center(header),
            Align.center(status_table),
            Text(""), # spacer
            content,
            Text(""), # spacer
            Align.center(Text("HiVoid Hub v1.0.0-Stable | Management Terminal", style="dim italic"))
        )

    def run_cmd(self, i):
        console.clear()
        label = self.menu_items[i][1]
        console.print(Panel(Align.center(f"[bold blue]EXECUTING: {label.upper()}[/]"), box=box.HEAVY, style="cyan"))
        
        try:
            if i == 0: # Restart
                subprocess.run(["systemctl", "restart", self.service])
                subprocess.run(["systemctl", "restart", "nginx"])
            elif i == 1: # Stop
                subprocess.run(["systemctl", "stop", self.service])
                subprocess.run(["systemctl", "stop", "nginx"])
                # Kill any orphaned backend processes just in case
                subprocess.run(["pkill", "-9", "-f", "uvicorn"], stderr=subprocess.DEVNULL)
            elif i == 2: # Start
                subprocess.run(["systemctl", "start", self.service])
                subprocess.run(["systemctl", "start", "nginx"])
            elif i == 3: # Reset Pass
                u = Prompt.ask("Admin Username")
                p = Prompt.ask("New Password", password=True)
                db = SessionLocal()
                admin = db.query(AdminUser).filter(AdminUser.username == u).first()
                if admin:
                    admin.hashed_password = get_password_hash(p)
                    db.commit()
                    console.print("[bold green]Success: Password updated.[/]")
                else: console.print("[bold red]Admin user not found.[/]")
                db.close()
            elif i == 4: # Change User
                uo = Prompt.ask("Current Username")
                un = Prompt.ask("New Username")
                db = SessionLocal()
                admin = db.query(AdminUser).filter(AdminUser.username == uo).first()
                if admin:
                    admin.username = un
                    db.commit()
                    console.print(f"[bold green]Success: Username is now {un}.[/]")
                else: console.print("[bold red]Admin user not found.[/]")
                db.close()
            elif i == 5: # Timezone Selection
                import zoneinfo
                all_zones = sorted(list(zoneinfo.available_timezones()))
                search = ""
                while True:
                    console.clear()
                    console.print(Panel("[bold cyan]SELECT HUB TIMEZONE[/]", subtitle="Type to filter | Press ENTER to confirm matches | Q to cancel"))
                    
                    filtered = [z for z in all_zones if search.lower() in z.lower()]
                    
                    # Display top 15 matches
                    console.print(f"[dim]Search:[/][bold yellow] {search or '(Start typing...)'}")
                    console.print("-" * 30)
                    for idx, z in enumerate(filtered[:15]):
                        console.print(f" [bold blue]{idx+1}.[/] [white]{z}[/]")
                    
                    if len(filtered) > 15:
                        console.print(f"[dim]... and {len(filtered)-15} more matches.[/]")
                    
                    cmd = Prompt.ask("\n[bold]Select by number or type to filter[/]", default="")
                    
                    if cmd.lower() in ['q', 'exit']: break
                    
                    if cmd.isdigit():
                        if 1 <= int(cmd) <= len(filtered[:15]):
                            chosen_tz = filtered[int(cmd)-1]
                            db = SessionLocal()
                            save_hub_config(db, {"timezone": chosen_tz})
                            db.close()
                            console.print(f"[bold green]Success: Timezone set to {chosen_tz}[/]")
                            break
                    else:
                        search = cmd
            elif i == 6: # Token
                gen = Confirm.ask("Generate a secure random token automatically?", default=True)
                if gen: tk = secrets.token_hex(24)
                else: tk = Prompt.ask("Enter manual token")
                
                if tk:
                    db = SessionLocal()
                    save_hub_config(db, {"hub_master_token": tk})
                    db.close()
                    env_p = os.path.join(BACKEND_DIR, ".env")
                    if os.path.exists(env_p):
                        with open(env_p, "r") as f: lines = f.readlines()
                        with open(env_p, "w") as f:
                            for l in lines:
                                if l.startswith("HUB_MASTER_TOKEN="): f.write(f"HUB_MASTER_TOKEN={tk}\n")
                                else: f.write(l)
                    subprocess.run(["systemctl", "restart", self.service])
                    console.print(Panel(f"[bold cyan]NEW MASTER TOKEN:[/] [bold yellow]{tk}[/]", title="IMPORTANT: SAVE THIS TOKEN"))
            elif i == 7: # Professional Update via GitHub API
                if Confirm.ask("[bold yellow]This will stop all services and update HiVoid Hub to the latest release. Continue?[/]"):
                    try:
                        import urllib.request
                        import json
                        import zipfile
                        import shutil
                        import tempfile

                        console.print("[cyan]Connecting to GitHub API...[/]")
                        api_url = "https://api.github.com/repos/hivoid-org/hivoid-hub/releases/latest"
                        req = urllib.request.Request(api_url, headers={'User-Agent': 'HiVoid-Manager'})
                        with urllib.request.urlopen(req) as resp:
                            release_data = json.loads(resp.read().decode())
                        
                        tag = release_data.get('tag_name', 'latest')
                        zip_url = release_data.get('zipball_url')
                        console.print(f"[green]Found latest release: [bold]{tag}[/][/]")

                        # 1. Stop Services
                        console.print("[yellow]Shutting down services...[/]")
                        subprocess.run(["systemctl", "stop", self.service])
                        subprocess.run(["systemctl", "stop", "nginx"])

                        # 2. Backup .env
                        env_path = os.path.join(BACKEND_DIR, ".env")
                        temp_dir = tempfile.mkdtemp()
                        env_backup = os.path.join(temp_dir, ".env.bak")
                        if os.path.exists(env_path):
                            shutil.copy(env_path, env_backup)
                            console.print("[dim]Configuration backed up.[/]")

                        # 3. Download & Extract
                        zip_path = os.path.join(temp_dir, "release.zip")
                        console.print(f"[cyan]Downloading {tag}...[/]")
                        urllib.request.urlretrieve(zip_url, zip_path)

                        console.print("[cyan]Extracting and overwriting system files...[/]")
                        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                            zip_ref.extractall(temp_dir)
                        
                        # GitHub zips have a root folder like 'hivoid-org-hivoid-hub-abc123'
                        extracted_items = [d for d in os.listdir(temp_dir) if os.path.isdir(os.path.join(temp_dir, d)) and d.startswith('hivoid')]
                        if extracted_items:
                            src_dir = os.path.join(temp_dir, extracted_items[0])
                            # Overwrite INSTALL_DIR
                            for item in os.listdir(src_dir):
                                s = os.path.join(src_dir, item)
                                d = os.path.join(INSTALL_DIR, item)
                                if os.path.isdir(s):
                                    if os.path.exists(d): shutil.rmtree(d)
                                    shutil.copytree(s, d)
                                else:
                                    shutil.copy2(s, d)

                        # 4. Restore .env
                        if os.path.exists(env_backup):
                            shutil.copy(env_backup, env_path)
                            console.print("[dim]Configuration restored.[/]")

                        # 5. Update Dependencies
                        console.print("[cyan]Updating dependencies...[/]")
                        subprocess.run([os.path.join(BACKEND_DIR, "venv/bin/pip"), "install", "-U", "pip"], check=False)
                        subprocess.run([os.path.join(BACKEND_DIR, "venv/bin/pip"), "install", "-r", os.path.join(BACKEND_DIR, "requirements.txt")], check=False)

                        # 6. Restart Services
                        console.print("[green]Restoring services...[/]")
                        subprocess.run(["systemctl", "daemon-reload"])
                        subprocess.run(["systemctl", "start", self.service])
                        subprocess.run(["systemctl", "start", "nginx"])

                        console.print(Panel(
                            "[bold green]Update successful![/]\n\n"
                            "[bold yellow]IMPORTANT WARNING:[/]\n"
                            "If nodes do not automatically reconnect after a few minutes,\n"
                            "they must be manually reconnected to the Hub.",
                            title="SYSTEM UPDATED", box=box.DOUBLE, border_style="green"
                        ))
                        
                    except Exception as e:
                        console.print(f"[bold red]Update failed: {e}[/]")
                        # Attempt to bring services back up
                        subprocess.run(["systemctl", "start", self.service])
                        subprocess.run(["systemctl", "start", "nginx"])
            elif i == 8: # Uninstall
                if Prompt.ask("Type DELETE to confirm") == "DELETE":
                    subprocess.run(["systemctl", "stop", self.service], stderr=subprocess.DEVNULL)
                    subprocess.run(["systemctl", "disable", self.service], stderr=subprocess.DEVNULL)
                    sp = f"/etc/systemd/system/{self.service}.service"
                    if os.path.exists(sp): os.remove(sp)
                    subprocess.run(["systemctl", "daemon-reload"])
                    console.print("[bold red]System uninstalled successfully.[/]")
                    sys.exit(0)
            elif i == 9: sys.exit(0)
        except Exception as e: console.print(f"[bold red]System Error: {e}[/]")
        Prompt.ask("\n[dim]Press ENTER to return...[/]")

    def start(self):
        import termios, tty
        def getch():
            fd = sys.stdin.fileno()
            old = termios.tcgetattr(fd)
            try:
                tty.setraw(fd)
                c = sys.stdin.read(1)
                if c == '\x1b': c += sys.stdin.read(2)
            finally: termios.tcsetattr(fd, termios.TCSADRAIN, old)
            return c

        with Live(self.draw_ui(), screen=True, auto_refresh=False) as live:
            while True:
                live.update(self.draw_ui(), refresh=True)
                key = getch()
                if key == "\x1b[A": self.idx = (self.idx - 1) % len(self.menu_items)
                elif key == "\x1b[B": self.idx = (self.idx + 1) % len(self.menu_items)
                elif key in ["\r", "\n", "\x0d"]:
                    live.stop()
                    self.run_cmd(self.idx)
                    live.start()
                elif key in ["q", "Q"]: break

if __name__ == "__main__":
    if os.geteuid() != 0:
        print("Error: Run as root")
        sys.exit(1)
    HiVoidManager().start()
