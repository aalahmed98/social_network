package handlers

import (
	"bytes"
	"mime/multipart"
	"testing"
)

func TestValidateImageFile(t *testing.T) {
	tests := []struct {
		name        string
		filename    string
		content     []byte
		expectError bool
	}{
		{
			name:        "Valid JPEG file",
			filename:    "test.jpg",
			content:     []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46},
			expectError: false,
		},
		{
			name:        "Valid PNG file",
			filename:    "test.png",
			content:     []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00},
			expectError: false,
		},
		{
			name:        "Valid GIF file",
			filename:    "test.gif",
			content:     []byte{0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00},
			expectError: false,
		},
		{
			name:        "Invalid file extension",
			filename:    "test.txt",
			content:     []byte{0xFF, 0xD8, 0xFF, 0xE0},
			expectError: true,
		},
		{
			name:        "Invalid file signature",
			filename:    "test.jpg",
			content:     []byte{0x00, 0x00, 0x00, 0x00},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock multipart file
			reader := bytes.NewReader(tt.content)
			
			// Create a mock file header
			header := &multipart.FileHeader{
				Filename: tt.filename,
				Size:     int64(len(tt.content)),
			}

			// Create a mock file from the reader
			file := &mockFile{reader: reader}

			err := ValidateImageFile(file, header)
			
			if tt.expectError && err == nil {
				t.Errorf("Expected error for %s, but got none", tt.name)
			}
			
			if !tt.expectError && err != nil {
				t.Errorf("Expected no error for %s, but got: %v", tt.name, err)
			}
		})
	}
}

// mockFile implements multipart.File interface for testing
type mockFile struct {
	reader *bytes.Reader
}

func (m *mockFile) Read(p []byte) (n int, err error) {
	return m.reader.Read(p)
}

func (m *mockFile) ReadAt(p []byte, off int64) (n int, err error) {
	return m.reader.ReadAt(p, off)
}

func (m *mockFile) Seek(offset int64, whence int) (int64, error) {
	return m.reader.Seek(offset, whence)
}

func (m *mockFile) Close() error {
	return nil
} 