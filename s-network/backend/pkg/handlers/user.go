package handlers

//this code is to search for users
func GetUserById(userID int) (map[string]interface{}, error) {
	row := db.QueryRow(`
		SELECT id, first_name, last_name, nickname, username, avatar, about_me, is_public, created_at
		FROM users
		WHERE id = ?
	`, userID)

	var (
		id        int
		firstName string
		lastName  string
		nickname  string
		username  string
		avatar    string
		aboutMe   string
		isPublic  bool
		createdAt string
	)

	err := row.Scan(&id, &firstName, &lastName, &nickname, &username, &avatar, &aboutMe, &isPublic, &createdAt)
	if err != nil {
		return nil, err
	}

	user := map[string]interface{}{
		"id":         id,
		"first_name": firstName,
		"last_name":  lastName,
		"nickname":   nickname,
		"username":   username,
		"avatar":     avatar,
		"about_me":   aboutMe,
		"is_public":  isPublic,
		"created_at": createdAt,
	}

	return user, nil
}
