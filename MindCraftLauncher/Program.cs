using System;
using System.Diagnostics;
using System.IO;

class Program
{
    static void Main()
    {
        string exePath = AppDomain.CurrentDomain.BaseDirectory;

        var psi = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = "/c npm run gui",
            WorkingDirectory = exePath,

            UseShellExecute = false,                // necesario para ocultar consola
            CreateNoWindow = true,                 // oculta ventana
            WindowStyle = ProcessWindowStyle.Hidden,
            
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        try
        {
            using var proc = Process.Start(psi)!;
            // opcional: leer salidas si lo necesitas sin mostrar consola
            string output = proc.StandardOutput.ReadToEnd();
            string error = proc.StandardError.ReadToEnd();
            proc.WaitForExit();

            if (proc.ExitCode != 0)
                ShowMessage($"Error: {error}");
        }
        catch (Exception ex)
        {
            ShowMessage($"Fallo al iniciar: {ex.Message}");
        }
    }

    static void ShowMessage(string msg)
    {
        System.Windows.Forms.MessageBox.Show(msg, "MindCraft Launcher",
            System.Windows.Forms.MessageBoxButtons.OK,
            System.Windows.Forms.MessageBoxIcon.Error);
    }
}
