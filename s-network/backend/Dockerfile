FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install necessary dependencies
RUN apk add --no-cache gcc musl-dev

# Copy go.mod and go.sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN CGO_ENABLED=1 GOOS=linux go build -o server server.go

# Use a smaller image for the final container
FROM alpine:latest

WORKDIR /app

# Install SQLite
RUN apk add --no-cache sqlite

# Copy the binary from the builder stage
COPY --from=builder /app/server /app/server

# Copy migration files
COPY --from=builder /app/pkg/db/migrations /app/pkg/db/migrations

# Create data directory
RUN mkdir -p /app/data

# Expose the port
EXPOSE 8080

# Run the application
CMD ["/app/server"] 