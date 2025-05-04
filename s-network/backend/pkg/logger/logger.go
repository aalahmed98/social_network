package logger

import (
	"log"
	"os"

	"github.com/fatih/color"
)

var (
	// Create a green color printer
	redPrinter = color.New(color.FgGreen)
)

// Standard logger
var stdLog *log.Logger

func init() {
	// Initialize the standard logger
	stdLog = log.New(os.Stdout, "[SERVER] ", log.LstdFlags)
	
	// Enable colors globally
	color.NoColor = false
}

// Println prints a message in red
func Println(v ...interface{}) {
	stdLog.Println(redPrinter.Sprint(v...))
}

// Printf prints a formatted message in red
func Printf(format string, v ...interface{}) {
	stdLog.Print(redPrinter.Sprintf(format, v...))
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
	stdLog.Println(redPrinter.Sprintf(format, v...))
}

// Info prints an informational message in red
func Info(format string, v ...interface{}) {
	stdLog.Println(redPrinter.Sprintf(format, v...))
} 