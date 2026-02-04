import eel
import os
import sys

# Exposed functions for Svelte to call
@eel.expose
def get_system_info():
    return {
        "platform": sys.platform,
        "cwd": os.getcwd()
    }

@eel.expose
def save_program_to_device(json_content):
    """
    Search for CIRCUITPY drive and save the program.json.
    """
    try:
        # Simple cross-platform drive detection (Windows focus)
        drives = []
        if sys.platform == "win32":
            import string
            from ctypes import windll
            bitmask = windll.kernel32.GetLogicalDrives()
            for letter in string.ascii_uppercase:
                if bitmask & 1:
                    drives.append(f"{letter}:\\")
                bitmask >>= 1
        else:
            # For Linux/macOS (common mount points)
            drives = ["/Volumes", "/media"]

        target_drive = None
        for drive in drives:
            if sys.platform == "win32":
                # Check for CIRCUITPY label or just the directory name
                # For simplicity, we check if the label is CIRCUITPY (requires more logic)
                # or just look for a drive with the right folder structure.
                # Here we just look for a drive named CIRCUITPY if possible,
                # or a drive that contains 'code.py' or similar indicators.
                path = os.path.join(drive, "program.json") # We just want to find where to save
                if os.path.exists(os.path.join(drive, "boot_out.txt")): # common circuitpy indicator
                    target_drive = drive
                    break
        
        if not target_drive:
            # Fallback: check labeled drives if on windows
            return {"success": False, "error": "CIRCUITPY drive not found. Please plug it in."}

        target_path = os.path.join(target_drive, "program.json")
        with open(target_path, "w") as f:
            f.write(json_content)
        
        return {"success": True, "path": target_path}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    # In development, Svelte runs on 5173
    # In production, we'll serve the 'dist' folder
    if os.path.exists("dist"):
        eel.init("dist")
        eel.start("index.html", size=(1200, 800))
    else:
        # Development mode
        # We don't init a folder, just start with the URL
        eel.init("public") # dummy folder for dev
        eel.start({"port": 5173}, host="localhost", size=(1200, 800))
