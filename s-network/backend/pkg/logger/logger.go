package logger

import (
	"log"
	"os"

	"github.com/fatih/color"
)

var (
	// Create color printers
	greenPrinter = color.New(color.FgGreen)
	redPrinter   = color.New(color.FgRed)
	yellowPrinter = color.New(color.FgYellow)
)

// Standard logger
var stdLog *log.Logger

func init() {
	// Initialize the standard logger
	stdLog = log.New(os.Stdout, "[SERVER] ", log.LstdFlags)
	
	// Enable colors globally
	color.NoColor = false
}

// Println prints a message in green (for startup logs)
func Println(v ...interface{}) {
	stdLog.Println(greenPrinter.Sprint(v...))
}

// Printf prints a formatted message in green (for startup logs)
func Printf(format string, v ...interface{}) {
	stdLog.Print(greenPrinter.Sprintf(format, v...))
}

// Fatal logs a message then calls os.Exit(1)
func Fatal(v ...interface{}) {
	stdLog.Fatal(redPrinter.Sprint(v...))
}

// Fatalf logs a formatted message then calls os.Exit(1)
func Fatalf(format string, v ...interface{}) {
	stdLog.Fatalf("%s", redPrinter.Sprintf(format, v...))
}

// Error prints an error message in red
func Error(format string, v ...interface{}) {
	stdLog.Println(redPrinter.Sprintf("[ERROR] "+format, v...))
}

// Warning prints a warning message in yellow
func Warning(format string, v ...interface{}) {
	stdLog.Println(yellowPrinter.Sprintf("[WARNING] "+format, v...))
}

// Info prints an informational message in green
func Info(format string, v ...interface{}) {
	stdLog.Println(greenPrinter.Sprintf(format, v...))
} 