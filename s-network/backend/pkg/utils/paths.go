package utils

import (
	"os"
	"path/filepath"
)

// GetUploadsPath returns the configured uploads directory path
func GetUploadsPath() string {
	uploadsPath := os.Getenv("UPLOADS_PATH")
	if uploadsPath == "" {
		if os.Getenv("NODE_ENV") == "production" || os.Getenv("RENDER") != "" {
			uploadsPath = "/opt/render/project/uploads"
		} else {
			uploadsPath = "./uploads"
		}
	}
	return uploadsPath
}

// GetUploadSubdir returns the full path for a specific upload subdirectory
func GetUploadSubdir(subdir string) string {
	return filepath.Join(GetUploadsPath(), subdir)
}

// GetUploadURL returns the URL path for uploaded files
func GetUploadURL(filename, subdir string) string {
	return "/uploads/" + subdir + "/" + filename
}
