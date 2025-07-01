# Build stage
FROM golang:1.21-alpine AS builder

# Install git for fetching dependencies
RUN apk add --no-cache git

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o main server.go

# Final stage
FROM alpine:latest

# Install sqlite3 and ca-certificates
RUN apk --no-cache add ca-certificates sqlite

WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/main .

# Create necessary directories
RUN mkdir -p data uploads

# Expose port
EXPOSE 8080

# Run the binary
CMD ["./main"] 