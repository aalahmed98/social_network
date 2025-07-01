package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

// AnalyticsData represents the main dashboard analytics structure
type AnalyticsData struct {  
	// Overview stats
	TotalFollowers    int `json:"total_followers"`
	TotalFollowing    int `json:"total_following"`
	TotalPosts        int `json:"total_posts"`
	TotalLikes        int `json:"total_likes"`
	TotalComments     int `json:"total_comments"`
	
	// Growth data for different periods
	FollowerGrowth    GrowthData `json:"follower_growth"`
	PostGrowth        GrowthData `json:"post_growth"`
	LikeGrowth        GrowthData `json:"like_growth"`
	
	// Recent activity
	RecentFollowers   []FollowerData `json:"recent_followers"`
	TopPosts          []PostData     `json:"top_posts"`
	
	// Engagement metrics
	EngagementRate    float64 `json:"engagement_rate"`
	AvgLikesPerPost   float64 `json:"avg_likes_per_post"`
	AvgCommentsPerPost float64 `json:"avg_comments_per_post"`
}

// GrowthData represents growth metrics over different time periods
type GrowthData struct {
	LastDay    []DataPoint `json:"last_day"`
	LastWeek   []DataPoint `json:"last_week"`
	Last30Days []DataPoint `json:"last_30_days"`
}

// DataPoint represents a single data point in time series
type DataPoint struct {
	Date  string `json:"date"`
	Value int    `json:"value"`
}

// FollowerData represents follower information
type FollowerData struct {
	ID        int    `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Avatar    string `json:"avatar"`
	FollowedAt string `json:"followed_at"`
}

// PostData represents post analytics data
type PostData struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	LikesCount  int    `json:"likes_count"`
	CommentsCount int  `json:"comments_count"`
	CreatedAt   string `json:"created_at"`
}

// GetDashboardAnalytics returns comprehensive dashboard analytics
func GetDashboardAnalytics(w http.ResponseWriter, r *http.Request) {
	userID, err := getCurrentUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	analytics := AnalyticsData{}

	// Get total counts
	analytics.TotalFollowers = getTotalFollowers(userID)
	analytics.TotalFollowing = getTotalFollowing(userID)
	analytics.TotalPosts = getTotalPosts(userID)
	analytics.TotalLikes = getTotalLikes(userID)
	analytics.TotalComments = getTotalComments(userID)

	// Get growth data
	analytics.FollowerGrowth = getFollowerGrowth(userID)
	analytics.PostGrowth = getPostGrowth(userID)
	analytics.LikeGrowth = getLikeGrowth(userID)

	// Get recent activity
	analytics.RecentFollowers = getRecentFollowers(userID, 5)
	analytics.TopPosts = getTopPosts(userID, 5)

	// Calculate engagement metrics
	if analytics.TotalPosts > 0 {
		analytics.AvgLikesPerPost = float64(analytics.TotalLikes) / float64(analytics.TotalPosts)
		analytics.AvgCommentsPerPost = float64(analytics.TotalComments) / float64(analytics.TotalPosts)
		analytics.EngagementRate = (float64(analytics.TotalLikes + analytics.TotalComments) / float64(analytics.TotalPosts)) * 100
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analytics)
}

// GetFollowerAnalytics returns detailed follower analytics
func GetFollowerAnalytics(w http.ResponseWriter, r *http.Request) {
	userID, err := getCurrentUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "30d"
	}

	followerData := map[string]interface{}{
		"total_followers": getTotalFollowers(userID),
		"growth_data":     getFollowerGrowthByPeriod(userID, period),
		"recent_followers": getRecentFollowers(userID, 10),
		"follower_demographics": getFollowerDemographics(userID),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(followerData)
}

// GetPostAnalytics returns detailed post analytics
func GetPostAnalytics(w http.ResponseWriter, r *http.Request) {
	userID, err := getCurrentUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "30d"
	}

	postData := map[string]interface{}{
		"total_posts":      getTotalPosts(userID),
		"total_likes":      getTotalLikes(userID),
		"total_comments":   getTotalComments(userID),
		"post_growth":      getPostGrowthByPeriod(userID, period),
		"top_posts":        getTopPosts(userID, 10),
		"avg_engagement":   getAverageEngagement(userID),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(postData)
}

// GetEngagementAnalytics returns engagement analytics
func GetEngagementAnalytics(w http.ResponseWriter, r *http.Request) {
	userID, err := getCurrentUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "30d"
	}

	engagementData := map[string]interface{}{
		"engagement_rate":     getEngagementRate(userID),
		"likes_over_time":     getLikesOverTime(userID, period),
		"comments_over_time":  getCommentsOverTime(userID, period),
		"engagement_by_post":  getEngagementByPost(userID),
		"best_performing_posts": getBestPerformingPosts(userID, 5),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(engagementData)
}

// Helper functions to get analytics data

func getTotalFollowers(userID int) int {
	query := `SELECT COUNT(*) FROM followers WHERE following_id = ?`
	var count int
	err := db.QueryRow(query, userID).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

func getTotalFollowing(userID int) int {
	query := `SELECT COUNT(*) FROM followers WHERE follower_id = ?`
	var count int
	err := db.QueryRow(query, userID).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

func getTotalPosts(userID int) int {
	query := `SELECT COUNT(*) FROM posts WHERE user_id = ?`
	var count int
	err := db.QueryRow(query, userID).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

func getTotalLikes(userID int) int {
	query := `
		SELECT COUNT(*) 
		FROM votes v 
		JOIN posts p ON v.content_id = p.id 
		WHERE p.user_id = ? AND v.content_type = 'post' AND v.vote_type = 1
	`
	var count int
	err := db.QueryRow(query, userID).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

func getTotalComments(userID int) int {
	query := `
		SELECT COUNT(*) 
		FROM comments c 
		JOIN posts p ON c.post_id = p.id 
		WHERE p.user_id = ?
	`
	var count int
	err := db.QueryRow(query, userID).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

func getFollowerGrowth(userID int) GrowthData {
	return GrowthData{
		LastDay:    getFollowerGrowthByPeriod(userID, "1d"),
		LastWeek:   getFollowerGrowthByPeriod(userID, "7d"),
		Last30Days: getFollowerGrowthByPeriod(userID, "30d"),
	}
}

func getPostGrowth(userID int) GrowthData {
	return GrowthData{
		LastDay:    getPostGrowthByPeriod(userID, "1d"),
		LastWeek:   getPostGrowthByPeriod(userID, "7d"),
		Last30Days: getPostGrowthByPeriod(userID, "30d"),
	}
}

func getLikeGrowth(userID int) GrowthData {
	return GrowthData{
		LastDay:    getLikeGrowthByPeriod(userID, "1d"),
		LastWeek:   getLikeGrowthByPeriod(userID, "7d"),
		Last30Days: getLikeGrowthByPeriod(userID, "30d"),
	}
}



func getFollowerGrowthByPeriod(userID int, period string) []DataPoint {
	switch period {
	case "1d":
		return getFollowerGrowthHourly(userID)
	case "7d":
		return getFollowerGrowthDaily(userID, 7)
	case "30d":
		return getFollowerGrowthDaily(userID, 30)
	default:
		return getFollowerGrowthDaily(userID, 30)
	}
}

func getFollowerGrowthHourly(userID int) []DataPoint {
	dataPoints := make([]DataPoint, 0)
	now := time.Now()
	
	// Show last 24 hours in 4-hour intervals (6 data points)
	for i := 20; i >= 0; i -= 4 {
		startTime := now.Add(time.Duration(-i-4) * time.Hour)
		endTime := now.Add(time.Duration(-i) * time.Hour)
		
		query := `
			SELECT COUNT(*) 
			FROM followers 
			WHERE following_id = ? AND created_at >= ? AND created_at < ?
		`
		var count int
		err := db.QueryRow(query, userID, startTime.Format("2006-01-02 15:04:05"), endTime.Format("2006-01-02 15:04:05")).Scan(&count)
		if err != nil {
			count = 0
		}
		
		dataPoints = append(dataPoints, DataPoint{
			Date:  endTime.Format("15:04"),
			Value: count,
		})
	}
	
	return dataPoints
}

func getFollowerGrowthDaily(userID int, days int) []DataPoint {
	dataPoints := make([]DataPoint, 0)

	for i := days - 1; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i)
		dateStr := date.Format("2006-01-02")
		
		query := `
			SELECT COUNT(*) 
			FROM followers 
			WHERE following_id = ? AND DATE(created_at) = ?
		`
		var count int
		err := db.QueryRow(query, userID, dateStr).Scan(&count)
		if err != nil {
			count = 0
		}
		
		dataPoints = append(dataPoints, DataPoint{
			Date:  dateStr,
			Value: count,
		})
	}

	return dataPoints
}

func getPostGrowthByPeriod(userID int, period string) []DataPoint {
	switch period {
	case "1d":
		return getPostGrowthHourly(userID)
	case "7d":
		return getPostGrowthDaily(userID, 7)
	case "30d":
		return getPostGrowthDaily(userID, 30)
	default:
		return getPostGrowthDaily(userID, 30)
	}
}

func getPostGrowthHourly(userID int) []DataPoint {
	dataPoints := make([]DataPoint, 0)
	now := time.Now()
	
	// Show last 24 hours in 4-hour intervals (6 data points)
	for i := 20; i >= 0; i -= 4 {
		startTime := now.Add(time.Duration(-i-4) * time.Hour)
		endTime := now.Add(time.Duration(-i) * time.Hour)
		
		query := `
			SELECT COUNT(*) 
			FROM posts 
			WHERE user_id = ? AND created_at >= ? AND created_at < ?
		`
		var count int
		err := db.QueryRow(query, userID, startTime.Format("2006-01-02 15:04:05"), endTime.Format("2006-01-02 15:04:05")).Scan(&count)
		if err != nil {
			count = 0
		}
		
		dataPoints = append(dataPoints, DataPoint{
			Date:  endTime.Format("15:04"),
			Value: count,
		})
	}
	
	return dataPoints
}

func getPostGrowthDaily(userID int, days int) []DataPoint {
	dataPoints := make([]DataPoint, 0)

	for i := days - 1; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i)
		dateStr := date.Format("2006-01-02")
		
		query := `
			SELECT COUNT(*) 
			FROM posts 
			WHERE user_id = ? AND DATE(created_at) = ?
		`
		var count int
		err := db.QueryRow(query, userID, dateStr).Scan(&count)
		if err != nil {
			count = 0
		}
		
		dataPoints = append(dataPoints, DataPoint{
			Date:  dateStr,
			Value: count,
		})
	}

	return dataPoints
}

func getLikeGrowthByPeriod(userID int, period string) []DataPoint {
	switch period {
	case "1d":
		return getLikeGrowthHourly(userID)
	case "7d":
		return getLikeGrowthDaily(userID, 7)
	case "30d":
		return getLikeGrowthDaily(userID, 30)
	default:
		return getLikeGrowthDaily(userID, 30)
	}
}

func getLikeGrowthHourly(userID int) []DataPoint {
	dataPoints := make([]DataPoint, 0)
	now := time.Now()
	
	// Show last 24 hours in 4-hour intervals (6 data points)
	for i := 20; i >= 0; i -= 4 {
		startTime := now.Add(time.Duration(-i-4) * time.Hour)
		endTime := now.Add(time.Duration(-i) * time.Hour)
		
		query := `
			SELECT COUNT(*) 
			FROM votes v 
			JOIN posts p ON v.content_id = p.id 
			WHERE p.user_id = ? AND v.content_type = 'post' AND v.vote_type = 1 
			AND v.created_at >= ? AND v.created_at < ?
		`
		var count int
		err := db.QueryRow(query, userID, startTime.Format("2006-01-02 15:04:05"), endTime.Format("2006-01-02 15:04:05")).Scan(&count)
		if err != nil {
			count = 0
		}
		
		dataPoints = append(dataPoints, DataPoint{
			Date:  endTime.Format("15:04"),
			Value: count,
		})
	}
	
	return dataPoints
}

func getLikeGrowthDaily(userID int, days int) []DataPoint {
	dataPoints := make([]DataPoint, 0)

	for i := days - 1; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i)
		dateStr := date.Format("2006-01-02")
		
		query := `
			SELECT COUNT(*) 
			FROM votes v 
			JOIN posts p ON v.content_id = p.id 
			WHERE p.user_id = ? AND v.content_type = 'post' AND v.vote_type = 1 AND DATE(v.created_at) = ?
		`
		var count int
		err := db.QueryRow(query, userID, dateStr).Scan(&count)
		if err != nil {
			count = 0
		}
		
		dataPoints = append(dataPoints, DataPoint{
			Date:  dateStr,
			Value: count,
		})
	}

	return dataPoints
}

func getRecentFollowers(userID int, limit int) []FollowerData {
	query := `
		SELECT u.id, u.first_name, u.last_name, u.avatar, f.created_at
		FROM followers f
		JOIN users u ON f.follower_id = u.id
		WHERE f.following_id = ?
		ORDER BY f.created_at DESC
		LIMIT ?
	`
	
	rows, err := db.Query(query, userID, limit)
	if err != nil {
		return []FollowerData{}
	}
	defer rows.Close()

	followers := make([]FollowerData, 0)
	for rows.Next() {
		var f FollowerData
		var avatar *string
		var followedAt time.Time
		
		err := rows.Scan(&f.ID, &f.FirstName, &f.LastName, &avatar, &followedAt)
		if err != nil {
			continue
		}
		
		if avatar != nil {
			f.Avatar = *avatar
		}
		f.FollowedAt = followedAt.Format("2006-01-02 15:04:05")
		
		followers = append(followers, f)
	}

	return followers
}

func getTopPosts(userID int, limit int) []PostData {
	query := `
		SELECT p.id, p.title, p.content, p.upvotes, 
		       (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comments_count,
		       p.created_at
		FROM posts p
		WHERE p.user_id = ?
		ORDER BY (p.upvotes + (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)) DESC
		LIMIT ?
	`
	
	rows, err := db.Query(query, userID, limit)
	if err != nil {
		return []PostData{}
	}
	defer rows.Close()

	posts := make([]PostData, 0)
	for rows.Next() {
		var p PostData
		var createdAt time.Time
		var title sql.NullString
		
		err := rows.Scan(&p.ID, &title, &p.Content, &p.LikesCount, &p.CommentsCount, &createdAt)
		if err != nil {
			continue
		}
		
		if title.Valid {
			p.Title = title.String
		}
		p.CreatedAt = createdAt.Format("2006-01-02 15:04:05")
		
		// Truncate content if too long
		if len(p.Content) > 100 {
			p.Content = p.Content[:100] + "..."
		}
		
		posts = append(posts, p)
	}

	return posts
}

// Additional helper functions for detailed analytics

func getFollowerDemographics(userID int) map[string]interface{} {
	// This is a placeholder - you could expand this to include actual demographic data
	return map[string]interface{}{
		"public_profiles":  getPublicFollowersCount(userID),
		"private_profiles": getPrivateFollowersCount(userID),
	}
}

func getPublicFollowersCount(userID int) int {
	query := `
		SELECT COUNT(*) 
		FROM followers f
		JOIN users u ON f.follower_id = u.id
		WHERE f.following_id = ? AND u.is_public = true
	`
	var count int
	err := db.QueryRow(query, userID).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

func getPrivateFollowersCount(userID int) int {
	query := `
		SELECT COUNT(*) 
		FROM followers f
		JOIN users u ON f.follower_id = u.id
		WHERE f.following_id = ? AND u.is_public = false
	`
	var count int
	err := db.QueryRow(query, userID).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

func getAverageEngagement(userID int) float64 {
	totalPosts := getTotalPosts(userID)
	if totalPosts == 0 {
		return 0
	}
	
	totalLikes := getTotalLikes(userID)
	totalComments := getTotalComments(userID)
	
	return float64(totalLikes+totalComments) / float64(totalPosts)
}

func getEngagementRate(userID int) float64 {
	return getAverageEngagement(userID)
}

func getLikesOverTime(userID int, period string) []DataPoint {
	return getLikeGrowthByPeriod(userID, period)
}

func getCommentsOverTime(userID int, period string) []DataPoint {
	switch period {
	case "1d":
		return getCommentsGrowthHourly(userID)
	case "7d":
		return getCommentsGrowthDaily(userID, 7)
	case "30d":
		return getCommentsGrowthDaily(userID, 30)
	default:
		return getCommentsGrowthDaily(userID, 30)
	}
}

func getCommentsGrowthHourly(userID int) []DataPoint {
	dataPoints := make([]DataPoint, 0)
	now := time.Now()
	
	// Show last 24 hours in 4-hour intervals (6 data points)
	for i := 20; i >= 0; i -= 4 {
		startTime := now.Add(time.Duration(-i-4) * time.Hour)
		endTime := now.Add(time.Duration(-i) * time.Hour)
		
		query := `
			SELECT COUNT(*) 
			FROM comments c 
			JOIN posts p ON c.post_id = p.id 
			WHERE p.user_id = ? AND c.created_at >= ? AND c.created_at < ?
		`
		var count int
		err := db.QueryRow(query, userID, startTime.Format("2006-01-02 15:04:05"), endTime.Format("2006-01-02 15:04:05")).Scan(&count)
		if err != nil {
			count = 0
		}
		
		dataPoints = append(dataPoints, DataPoint{
			Date:  endTime.Format("15:04"),
			Value: count,
		})
	}
	
	return dataPoints
}

func getCommentsGrowthDaily(userID int, days int) []DataPoint {
	dataPoints := make([]DataPoint, 0)

	for i := days - 1; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i)
		dateStr := date.Format("2006-01-02")
		
		query := `
			SELECT COUNT(*) 
			FROM comments c 
			JOIN posts p ON c.post_id = p.id 
			WHERE p.user_id = ? AND DATE(c.created_at) = ?
		`
		var count int
		err := db.QueryRow(query, userID, dateStr).Scan(&count)
		if err != nil {
			count = 0
		}
		
		dataPoints = append(dataPoints, DataPoint{
			Date:  dateStr,
			Value: count,
		})
	}

	return dataPoints
}

func getEngagementByPost(userID int) []map[string]interface{} {
	query := `
		SELECT p.id, p.title, p.likes_count,
		       (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comments_count
		FROM posts p
		WHERE p.user_id = ?
		ORDER BY p.created_at DESC
		LIMIT 10
	`
	
	rows, err := db.Query(query, userID)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer rows.Close()

	posts := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, likesCount, commentsCount int
		var title string
		
		err := rows.Scan(&id, &title, &likesCount, &commentsCount)
		if err != nil {
			continue
		}
		
		posts = append(posts, map[string]interface{}{
			"id":             id,
			"title":          title,
			"likes_count":    likesCount,
			"comments_count": commentsCount,
			"total_engagement": likesCount + commentsCount,
		})
	}

	return posts
}

func getBestPerformingPosts(userID int, limit int) []PostData {
	return getTopPosts(userID, limit)
}



func getCurrentUserID(r *http.Request) (int, error) {
	session, err := store.Get(r, SessionCookieName)
	if err != nil {
		return 0, err
	}

	userID, ok := session.Values["user_id"].(int)
	if !ok {
		return 0, err
	}

	return userID, nil
} 