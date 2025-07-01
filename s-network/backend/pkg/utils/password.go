package utils

import (
	"regexp"
	"strings"
)

// PasswordValidationResult represents the result of password validation
type PasswordValidationResult struct {
	IsValid bool     `json:"is_valid"`
	Errors  []string `json:"errors"`
}

// ValidatePassword validates password according to security requirements
// Requirements:
// - No spaces allowed
// - Minimum 8 characters
// - At least one uppercase letter (A-Z)
// - At least one lowercase letter (a-z)  
// - At least one special character (!@#$%^&* etc.)
// - Not a common password
func ValidatePassword(password string) PasswordValidationResult {
	var errors []string

	// Check for spaces first - immediate rejection
	if strings.Contains(password, " ") {
		errors = append(errors, "Password cannot contain spaces")
		return PasswordValidationResult{IsValid: false, Errors: errors}
	}

	// Check minimum length (8 characters)
	if len(password) < 8 {
		errors = append(errors, "Password must be at least 8 characters long")
	}

	// Check for uppercase letter
	uppercaseRegex := regexp.MustCompile(`[A-Z]`)
	if !uppercaseRegex.MatchString(password) {
		errors = append(errors, "Password must contain at least one uppercase letter (A-Z)")
	}

	// Check for lowercase letter
	lowercaseRegex := regexp.MustCompile(`[a-z]`)
	if !lowercaseRegex.MatchString(password) {
		errors = append(errors, "Password must contain at least one lowercase letter (a-z)")
	}

	// Check for special characters - comprehensive list including !@ and more
	specialCharRegex := regexp.MustCompile(`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~` + "`" + `]`)
	if !specialCharRegex.MatchString(password) {
		errors = append(errors, "Password must contain at least one special character (!@#$%^&* etc.)")
	}

	// Check against common passwords
	commonPasswords := []string{
		"password", "123456", "123456789", "qwerty", "abc123",
		"password123", "admin", "letmein", "welcome", "monkey",
		"iloveyou", "princess", "dragon", "rockyou", "654321",
		"michael", "mustang", "master", "sunshine", "ashley",
		"bailey", "passw0rd", "shadow", "123123", "654321",
		"superman", "qazwsx", "michael", "football",
	}

	passwordLower := strings.ToLower(password)
	for _, common := range commonPasswords {
		if passwordLower == common {
			errors = append(errors, "Password is too common, please choose a stronger password")
			break
		}
	}

	return PasswordValidationResult{
		IsValid: len(errors) == 0,
		Errors:  errors,
	}
}

// GetPasswordStrengthScore returns a score from 0-4 based on password criteria met
func GetPasswordStrengthScore(password string) int {
	score := 0

	// Don't give any points if password contains spaces
	if strings.Contains(password, " ") {
		return 0
	}

	// Length check
	if len(password) >= 8 {
		score++
	}

	// Uppercase check
	if matched, _ := regexp.MatchString(`[A-Z]`, password); matched {
		score++
	}

	// Lowercase check
	if matched, _ := regexp.MatchString(`[a-z]`, password); matched {
		score++
	}

	// Special character check
	if matched, _ := regexp.MatchString(`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`+"`"+`]`, password); matched {
		score++
	}

	return score
} 