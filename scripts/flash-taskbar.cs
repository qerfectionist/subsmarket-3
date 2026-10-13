using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

public class Program {
    public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll")] public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumProc lpfn, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] public static extern bool FlashWindowEx(ref FLASHWINFO pwfi);
    [DllImport("user32.dll")] public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("winmm.dll", CharSet = CharSet.Auto)] public static extern bool PlaySound(string pszSound, IntPtr hmod, uint fdwSound);

    [StructLayout(LayoutKind.Sequential)]
    public struct FLASHWINFO {
        public uint cbSize;
        public IntPtr hwnd;
        public uint dwFlags;
        public uint uCount;
        public uint dwTimeout;
    }

    public static void Main() {
        // 1. Play sound asynchronously via winmm
        string soundPath = @"C:\Windows\Media\Windows Notify.wav";
        if (!File.Exists(soundPath)) {
            soundPath = @"C:\Windows\Media\notify.wav";
        }
        if (File.Exists(soundPath)) {
            PlaySound(soundPath, IntPtr.Zero, 0x00020001); // SND_FILENAME | SND_ASYNC
        } else {
            PlaySound("SystemNotification", IntPtr.Zero, 0x00010001);
        }

        // 2. Flash Antigravity icon on Windows Taskbar
        IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) {
            EnumDesktopWindows(hDesk, (hWnd, lParam) => {
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                try {
                    var p = Process.GetProcessById((int)pid);
                    if (p.ProcessName.Equals("antigravity", StringComparison.OrdinalIgnoreCase)) {
                        FLASHWINFO fi = new FLASHWINFO();
                        fi.cbSize = (uint)Marshal.SizeOf(typeof(FLASHWINFO));
                        fi.hwnd = hWnd;
                        fi.dwFlags = 3 | 12; // FLASHW_ALL | FLASHW_TIMERNOFG (pulse orange until window is focused)
                        fi.uCount = 5;
                        fi.dwTimeout = 0;
                        FlashWindowEx(ref fi);
                    }
                } catch {}
                return true;
            }, IntPtr.Zero);
            CloseDesktop(hDesk);
        }

        // Brief 450ms sleep so the audio device finishes the chime without blocking the agent
        Thread.Sleep(450);
    }
}
