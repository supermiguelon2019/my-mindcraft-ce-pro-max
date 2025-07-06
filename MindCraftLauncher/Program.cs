using System;
using System.Diagnostics;
using System.IO;

class Program
{
    static void Main()
    {
        string exePath = AppDomain.CurrentDomain.BaseDirectory;
        string nodeModulesPath = Path.Combine(exePath, "node_modules");

        try
        {
            if (!Directory.Exists(nodeModulesPath))
            {
                RunCommandWithWindow("npm install", exePath);
            }
            
            RunCommand("npm run gui", exePath);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error al iniciar: {ex.Message}");
        }
    }

    static void RunCommand(string command, string workingDirectory)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = $"/c {command}",
            WorkingDirectory = workingDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        using var proc = Process.Start(psi)!;
        string output = proc.StandardOutput.ReadToEnd();
        string error = proc.StandardError.ReadToEnd();
        proc.WaitForExit();

        if (proc.ExitCode != 0)
        {
            throw new Exception($"Error al ejecutar '{command}': {error}");
        }
    }

    static void RunCommandWithWindow(string command, string workingDirectory)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = $"/k {command} & exit",
            WorkingDirectory = workingDirectory,
            UseShellExecute = true,
            CreateNoWindow = false
        };

        using var proc = Process.Start(psi)!;
        proc.WaitForExit();

        if (proc.ExitCode != 0)
        {
            throw new Exception($"Error al ejecutar '{command}'");
        }
    }
}
