package handlers

import (
	"archive/zip"
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"zendown/database"
	"zendown/search"
	"zendown/semware"

	"github.com/JohannesKaufmann/html-to-markdown/v2/converter"
	"github.com/JohannesKaufmann/html-to-markdown/v2/plugin/base"
	"github.com/JohannesKaufmann/html-to-markdown/v2/plugin/commonmark"
	"github.com/JohannesKaufmann/html-to-markdown/v2/plugin/table"
	"github.com/gorilla/mux"
	"golang.org/x/net/html"
)

type Handler struct {
	db      *database.DB
	semware *semware.Client
	bm25    *search.BM25SearchService
}

func NewHandler(db *database.DB) *Handler {
	// Initialize BM25 search service
	log.Printf("Initializing BM25 search service...")
	bm25Service, err := search.NewBM25SearchService("data/bm25_index")
	if err != nil {
		log.Printf("Warning: Failed to initialize BM25 search service: %v", err)
		bm25Service = nil
	} else {
		log.Printf("BM25 search service initialized successfully")
	}

	return &Handler{
		db:      db,
		semware: semware.NewClient(),
		bm25:    bm25Service,
	}
}

type CreateNoteRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type UpdateNoteRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type AddCollectionRequest struct {
	CollectionName string `json:"collection_name"`
}

type RemoveCollectionRequest struct {
	CollectionName string `json:"collection_name"`
}

type CreateAutoCollectionRequest struct {
	CollectionName string  `json:"collection_name"`
	Description    string  `json:"description"`
	Threshold      float64 `json:"threshold"`
}

type SyncAutoCollectionRequest struct {
	CollectionID int64 `json:"collection_id"`
}

func (h *Handler) CreateNote(w http.ResponseWriter, r *http.Request) {
	var req CreateNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		req.Title = "Untitled Note"
	}

	note, err := h.db.CreateNote(req.Title, req.Content)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Sync with SemWare
	go func() {
		if _, err := h.semware.UpsertDocument(strconv.FormatInt(note.ID, 10), note.Content); err != nil {
			log.Printf("Failed to sync note %d with SemWare: %v", note.ID, err)
		}
	}()

	// Sync with BM25 index
	go func() {
		if h.bm25 != nil {
			if err := h.bm25.IndexNote(note); err != nil {
				log.Printf("Failed to sync note %d with BM25 index: %v", note.ID, err)
			}
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(note)
}

func (h *Handler) GetNote(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	note, err := h.db.GetNote(id)
	if err != nil {
		http.Error(w, "Note not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(note)
}

func (h *Handler) GetAllNotes(w http.ResponseWriter, r *http.Request) {
	notes, err := h.db.GetAllNotes()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notes)
}

func (h *Handler) UpdateNote(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	var req UpdateNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	note, err := h.db.UpdateNote(id, req.Title, req.Content)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Sync with SemWare
	go func() {
		if _, err := h.semware.UpsertDocument(strconv.FormatInt(note.ID, 10), note.Content); err != nil {
			log.Printf("Failed to sync note %d with SemWare: %v", note.ID, err)
		}
	}()

	// Sync with BM25 index
	go func() {
		if h.bm25 != nil {
			if err := h.bm25.IndexNote(note); err != nil {
				log.Printf("Failed to sync note %d with BM25 index: %v", note.ID, err)
			}
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(note)
}

func (h *Handler) DeleteNote(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	if err := h.db.DeleteNote(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Delete from SemWare
	go func() {
		if err := h.semware.DeleteDocument(strconv.FormatInt(id, 10)); err != nil {
			log.Printf("Failed to delete note %d from SemWare: %v", id, err)
		}
	}()

	// Delete from BM25 index
	go func() {
		if h.bm25 != nil {
			if err := h.bm25.RemoveNote(id); err != nil {
				log.Printf("Failed to delete note %d from BM25 index: %v", id, err)
			}
		}
	}()

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) SearchNotes(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	notes, err := h.db.SearchNotes(query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notes)
}

// RelatedNoteResponse represents a note with its similarity score
type RelatedNoteResponse struct {
	Note  *database.Note `json:"note"`
	Score float64        `json:"score"`
}

// GetRelatedNotes returns related notes for a given note ID
func (h *Handler) GetRelatedNotes(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	// Get query parameters
	thresholdStr := r.URL.Query().Get("threshold")

	threshold := 0.3 // default threshold
	if thresholdStr != "" {
		if t, err := strconv.ParseFloat(thresholdStr, 64); err == nil {
			threshold = t
		}
	}

	// Get similar documents from SemWare
	semwareResponse, err := h.semware.GetSimilarDocuments(strconv.FormatInt(id, 10), threshold)
	if err != nil {
		log.Printf("Failed to get similar documents for note %d: %v", id, err)
		http.Error(w, "Failed to get related notes", http.StatusInternalServerError)
		return
	}

	// Get the actual note objects for the related note IDs
	var relatedNotes []RelatedNoteResponse
	for _, result := range semwareResponse.SimilarResults {
		noteID, err := strconv.ParseInt(result.ID, 10, 64)
		if err != nil {
			continue
		}

		note, err := h.db.GetNote(noteID)
		if err != nil {
			continue // Skip if note not found
		}

		relatedNotes = append(relatedNotes, RelatedNoteResponse{
			Note:  note,
			Score: result.Score,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(relatedNotes)
}

// SemanticSearchResponse represents a note with its similarity score from semantic search
type SemanticSearchResponse struct {
	Note  *database.Note `json:"note"`
	Score float64        `json:"score"`
}

// FullTextSearchResponse represents a note with its BM25 score from full-text search
type FullTextSearchResponse struct {
	Note  *database.Note `json:"note"`
	Score float64        `json:"score"`
}

// SemanticSearch performs semantic search across all notes
func (h *Handler) SemanticSearch(w http.ResponseWriter, r *http.Request) {
	// Get query parameters
	query := r.URL.Query().Get("q")
	if query == "" {
		log.Printf("SemanticSearch: Missing query parameter")
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	log.Printf("SemanticSearch: Query='%s'", query)

	thresholdStr := r.URL.Query().Get("threshold")

	threshold := 0.3 // default threshold (30% similarity)
	if thresholdStr != "" {
		if t, err := strconv.ParseFloat(thresholdStr, 64); err == nil {
			threshold = t
		}
	}

	log.Printf("SemanticSearch: threshold=%f", threshold)

	// Perform semantic search using SemWare
	semwareResponse, err := h.semware.SemanticSearch(query, threshold)
	if err != nil {
		log.Printf("SemanticSearch: SemWare error: %v", err)
		http.Error(w, fmt.Sprintf("Failed to perform semantic search: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("SemanticSearch: SemWare returned %d results", len(semwareResponse.SimilarResults))

	// Convert SemWare results to our response format
	var searchResults []SemanticSearchResponse
	for _, result := range semwareResponse.SimilarResults {
		// Convert document ID back to note ID
		noteID, err := strconv.ParseInt(result.ID, 10, 64)
		if err != nil {
			log.Printf("SemanticSearch: Failed to parse note ID %s: %v", result.ID, err)
			continue
		}

		// Get the note from database
		note, err := h.db.GetNote(noteID)
		if err != nil {
			log.Printf("SemanticSearch: Failed to get note %d: %v", noteID, err)
			continue
		}

		searchResults = append(searchResults, SemanticSearchResponse{
			Note:  note,
			Score: result.Score,
		})
	}

	log.Printf("SemanticSearch: Returning %d results", len(searchResults))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(searchResults)
}

// FullTextSearch performs BM25 full-text search across all notes
func (h *Handler) FullTextSearch(w http.ResponseWriter, r *http.Request) {
	// Get query parameters
	query := r.URL.Query().Get("q")
	if query == "" {
		log.Printf("FullTextSearch: Missing query parameter")
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	log.Printf("FullTextSearch: Query='%s'", query)

	limitStr := r.URL.Query().Get("limit")
	limit := 20 // default limit
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	// Check if BM25 service is available
	if h.bm25 == nil {
		log.Printf("FullTextSearch: BM25 service not available")
		http.Error(w, "Full-text search service not available", http.StatusInternalServerError)
		return
	}

	log.Printf("FullTextSearch: Performing search with limit=%d", limit)

	// Perform BM25 search
	searchResults, err := h.bm25.Search(query, limit)
	if err != nil {
		log.Printf("FullTextSearch: BM25 search error: %v", err)
		http.Error(w, fmt.Sprintf("Failed to perform full-text search: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("FullTextSearch: BM25 returned %d raw results", len(searchResults))

	// Convert to response format
	var results []FullTextSearchResponse
	for _, result := range searchResults {
		if result.Note != nil {
			results = append(results, FullTextSearchResponse{
				Note:  result.Note,
				Score: result.Score,
			})
		}
	}

	log.Printf("FullTextSearch: Returning %d valid results", len(results))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// Supported image MIME types
var supportedMimeTypes = map[string]bool{
	"image/jpeg":    true,
	"image/jpg":     true,
	"image/png":     true,
	"image/svg+xml": true,
	"image/gif":     true,
	"image/webp":    true,
}

// UploadAttachment handles file uploads for attachments
func (h *Handler) UploadAttachment(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form (max 10MB)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		log.Printf("Failed to parse multipart form: %v", err)
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	// Get the uploaded file
	file, header, err := r.FormFile("file")
	if err != nil {
		log.Printf("No file uploaded: %v", err)
		http.Error(w, "No file uploaded", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Log upload attempt
	log.Printf("Uploading file: %s (%s, %d bytes)", header.Filename, header.Header.Get("Content-Type"), header.Size)

	// Validate file type
	contentType := header.Header.Get("Content-Type")
	if !supportedMimeTypes[contentType] {
		log.Printf("Unsupported file type: %s", contentType)
		http.Error(w, "Unsupported file type", http.StatusBadRequest)
		return
	}

	// Validate file size (max 5MB)
	if header.Size > 5<<20 {
		log.Printf("File too large: %d bytes", header.Size)
		http.Error(w, "File too large (max 5MB)", http.StatusBadRequest)
		return
	}

	// Generate unique filename
	ext := filepath.Ext(header.Filename)
	uniqueID := generateUniqueID()
	baseFilename := uniqueID + ext
	filename := generateUniqueFilename("attachments", baseFilename)
	filePath := filepath.Join("attachments", filename)

	// Ensure attachments directory exists
	if err := os.MkdirAll("attachments", 0755); err != nil {
		log.Printf("Failed to create attachments directory: %v", err)
		http.Error(w, "Failed to create attachments directory", http.StatusInternalServerError)
		return
	}

	// Create the file
	dst, err := os.Create(filePath)
	if err != nil {
		log.Printf("Failed to create file %s: %v", filePath, err)
		http.Error(w, "Failed to create file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Copy the uploaded file to the destination file
	if _, err := io.Copy(dst, file); err != nil {
		log.Printf("Failed to save file %s: %v", filePath, err)
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	// Generate URL for the file
	fileURL := fmt.Sprintf("/api/attachments/%s", filename)

	// Save attachment metadata to database
	attachment, err := h.db.CreateAttachment(
		filename,
		header.Filename,
		contentType,
		filePath,
		fileURL,
		header.Size,
	)
	if err != nil {
		// Clean up the file if database save fails
		log.Printf("Failed to save attachment metadata, cleaning up file %s: %v", filePath, err)
		os.Remove(filePath)
		http.Error(w, "Failed to save attachment metadata", http.StatusInternalServerError)
		return
	}

	// Log successful upload
	log.Printf("Successfully uploaded attachment: %s -> %s", header.Filename, filename)

	// Return the attachment info
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(attachment)
}

// GetAllAttachments returns all attachments
func (h *Handler) GetAllAttachments(w http.ResponseWriter, r *http.Request) {
	attachments, err := h.db.GetAllAttachments()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(attachments)
}

// DeleteAttachment handles attachment deletion
func (h *Handler) DeleteAttachment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid attachment ID", http.StatusBadRequest)
		return
	}

	// Get attachment info before deletion for file cleanup
	attachment, err := h.db.GetAttachment(id)
	if err != nil {
		http.Error(w, "Attachment not found", http.StatusNotFound)
		return
	}

	// Delete from database
	if err := h.db.DeleteAttachment(id); err != nil {
		log.Printf("Failed to delete attachment from database: %v", err)
		http.Error(w, "Failed to delete attachment", http.StatusInternalServerError)
		return
	}

	// Delete file from disk
	if err := os.Remove(attachment.Path); err != nil {
		log.Printf("Failed to delete file %s: %v", attachment.Path, err)
		// Don't return error here as the database deletion was successful
		// The file will be cleaned up later by the cleanup process
	}

	log.Printf("Successfully deleted attachment: %s", attachment.OriginalName)

	w.WriteHeader(http.StatusNoContent)
}

// ServeAttachment serves uploaded files
func (h *Handler) ServeAttachment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	filename := vars["filename"]

	// Validate filename to prevent directory traversal
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") {
		log.Printf("Invalid filename attempted: %s", filename)
		http.Error(w, "Invalid filename", http.StatusBadRequest)
		return
	}

	filePath := filepath.Join("attachments", filename)

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		log.Printf("File not found: %s", filePath)
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	// Set appropriate headers for image files
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg":
		w.Header().Set("Content-Type", "image/jpeg")
	case ".png":
		w.Header().Set("Content-Type", "image/png")
	case ".gif":
		w.Header().Set("Content-Type", "image/gif")
	case ".svg":
		w.Header().Set("Content-Type", "image/svg+xml")
	case ".webp":
		w.Header().Set("Content-Type", "image/webp")
	default:
		w.Header().Set("Content-Type", "application/octet-stream")
	}

	// Set cache headers for better performance
	w.Header().Set("Cache-Control", "public, max-age=31536000") // 1 year

	// Serve the file
	http.ServeFile(w, r, filePath)
}

// CleanupOrphanedFiles removes files that exist on disk but not in the database
func (h *Handler) CleanupOrphanedFiles() error {
	// This is a placeholder for future implementation
	// In a production system, you might want to run this periodically
	// to clean up files that were uploaded but not saved to the database
	return nil
}

// generateUniqueID generates a unique 16-character hex string
func generateUniqueID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// generateUniqueFilename ensures a unique filename by appending numbers if the file already exists
func generateUniqueFilename(dir, filename string) string {
	ext := filepath.Ext(filename)
	base := strings.TrimSuffix(filename, ext)
	counter := 1
	newFilename := filename

	for {
		filePath := filepath.Join(dir, newFilename)
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			// File doesn't exist, we can use this filename
			break
		}
		// File exists, try with counter
		newFilename = fmt.Sprintf("%s_%d%s", base, counter, ext)
		counter++
	}

	return newFilename
}

// Collection handlers
func (h *Handler) GetAllCollections(w http.ResponseWriter, r *http.Request) {
	collections, err := h.db.GetAllCollections()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(collections)
}

func (h *Handler) GetNoteCollections(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	noteID, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	collections, err := h.db.GetNoteCollections(noteID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(collections)
}

func (h *Handler) GetNotesByCollection(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	collectionID, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid collection ID", http.StatusBadRequest)
		return
	}

	notes, err := h.db.GetNotesByCollection(collectionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notes)
}

func (h *Handler) AddNoteToCollection(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	noteID, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	var req AddCollectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.CollectionName == "" {
		http.Error(w, "Collection name is required", http.StatusBadRequest)
		return
	}

	// Get or create the collection
	collection, err := h.db.GetOrCreateCollection(req.CollectionName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Add note to collection
	if err := h.db.AddNoteToCollection(noteID, collection.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(collection)
}

func (h *Handler) RemoveNoteFromCollection(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	noteID, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	var req RemoveCollectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.CollectionName == "" {
		http.Error(w, "Collection name is required", http.StatusBadRequest)
		return
	}

	// Get the collection
	collection, err := h.db.GetCollectionByName(req.CollectionName)
	if err != nil {
		http.Error(w, "Collection not found", http.StatusNotFound)
		return
	}

	// Remove note from collection
	if err := h.db.RemoveNoteFromCollection(noteID, collection.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// CreateAutoCollection creates a new auto-collection and populates it with semantically similar notes
func (h *Handler) CreateAutoCollection(w http.ResponseWriter, r *http.Request) {
	var req CreateAutoCollectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.CollectionName == "" {
		http.Error(w, "Collection name is required", http.StatusBadRequest)
		return
	}

	if req.Description == "" {
		http.Error(w, "Description is required", http.StatusBadRequest)
		return
	}

	// Validate threshold
	if req.Threshold < 0 || req.Threshold > 1 {
		http.Error(w, "Threshold must be between 0 and 1", http.StatusBadRequest)
		return
	}

	// Create the auto-collection
	collection, err := h.db.CreateAutoCollection(req.CollectionName, req.Description, req.Threshold, true)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Perform semantic search to find similar notes
	semwareResponse, err := h.semware.SemanticSearch(req.Description, req.Threshold)
	if err != nil {
		log.Printf("Failed to perform semantic search for auto-collection %s: %v", req.CollectionName, err)
		// Don't fail the request, just return the collection without notes
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(collection)
		return
	}

	// Add notes to the collection
	var noteIDs []int64
	for _, result := range semwareResponse.SimilarResults {
		noteID, err := strconv.ParseInt(result.ID, 10, 64)
		if err != nil {
			continue
		}

		// Verify the note exists
		if _, err := h.db.GetNote(noteID); err != nil {
			continue
		}

		noteIDs = append(noteIDs, noteID)
	}

	// Sync the collection with the found notes
	if len(noteIDs) > 0 {
		if err := h.db.SyncAutoCollection(collection.ID, noteIDs); err != nil {
			log.Printf("Failed to sync auto-collection %s: %v", req.CollectionName, err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(collection)
}

// SyncAutoCollection updates an auto-collection with new semantically similar notes
func (h *Handler) SyncAutoCollection(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	collectionID, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid collection ID", http.StatusBadRequest)
		return
	}

	// Get the collection
	collection, err := h.db.GetCollection(collectionID)
	if err != nil {
		http.Error(w, "Collection not found", http.StatusNotFound)
		return
	}

	if !collection.IsAuto {
		http.Error(w, "Only auto-collections can be synced", http.StatusBadRequest)
		return
	}

	// Perform semantic search to find similar notes
	semwareResponse, err := h.semware.SemanticSearch(collection.Description, collection.Threshold)
	if err != nil {
		log.Printf("Failed to perform semantic search for auto-collection %s: %v", collection.Name, err)
		http.Error(w, "Failed to perform semantic search", http.StatusInternalServerError)
		return
	}

	// Get note IDs from search results
	var noteIDs []int64
	for _, result := range semwareResponse.SimilarResults {
		noteID, err := strconv.ParseInt(result.ID, 10, 64)
		if err != nil {
			continue
		}

		// Verify the note exists
		if _, err := h.db.GetNote(noteID); err != nil {
			continue
		}

		noteIDs = append(noteIDs, noteID)
	}

	// Sync the collection with the found notes
	if err := h.db.SyncAutoCollection(collectionID, noteIDs); err != nil {
		log.Printf("Failed to sync auto-collection %s: %v", collection.Name, err)
		http.Error(w, "Failed to sync collection", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) SetupRoutes(router *mux.Router) {
	// API routes
	api := router.PathPrefix("/api").Subrouter()
	api.HandleFunc("/notes", h.CreateNote).Methods("POST")
	api.HandleFunc("/notes", h.GetAllNotes).Methods("GET")
	api.HandleFunc("/notes/search", h.SearchNotes).Methods("GET")
	api.HandleFunc("/notes/semantic-search", h.SemanticSearch).Methods("GET")
	api.HandleFunc("/notes/fulltext-search", h.FullTextSearch).Methods("GET")
	api.HandleFunc("/notes/export-all", h.ExportAllNotesAsZip).Methods("GET")
	api.HandleFunc("/notes/{id}", h.GetNote).Methods("GET")
	api.HandleFunc("/notes/{id}", h.UpdateNote).Methods("PUT")
	api.HandleFunc("/notes/{id}", h.DeleteNote).Methods("DELETE")
	api.HandleFunc("/notes/{id}/related", h.GetRelatedNotes).Methods("GET")
	api.HandleFunc("/notes/{id}/export", h.ExportNoteAsMarkdown).Methods("GET")
	api.HandleFunc("/notes/{id}/export-raw", h.ExportNoteAsRawHTML).Methods("GET")

	// Attachment routes
	api.HandleFunc("/attachments/upload", h.UploadAttachment).Methods("POST")
	api.HandleFunc("/attachments/all", h.GetAllAttachments).Methods("GET")
	api.HandleFunc("/attachments/{id}", h.DeleteAttachment).Methods("DELETE")
	api.HandleFunc("/attachments/{filename}", h.ServeAttachment).Methods("GET")

	// Collection routes
	api.HandleFunc("/collections", h.GetAllCollections).Methods("GET")
	api.HandleFunc("/notes/{id}/collections", h.GetNoteCollections).Methods("GET")
	api.HandleFunc("/collections/{id}/notes", h.GetNotesByCollection).Methods("GET")
	api.HandleFunc("/notes/{id}/collections", h.AddNoteToCollection).Methods("POST")
	api.HandleFunc("/notes/{id}/collections", h.RemoveNoteFromCollection).Methods("DELETE")
	api.HandleFunc("/collections/auto", h.CreateAutoCollection).Methods("POST")
	api.HandleFunc("/collections/auto/{id}", h.SyncAutoCollection).Methods("PUT")
}

// RebuildBM25Index rebuilds the BM25 search index from all notes in the database
func (h *Handler) RebuildBM25Index() error {
	if h.bm25 == nil {
		return fmt.Errorf("BM25 service not available")
	}

	log.Printf("Starting BM25 index rebuild...")

	// Get all notes from database
	notes, err := h.db.GetAllNotes()
	if err != nil {
		return fmt.Errorf("failed to get notes for index rebuild: %w", err)
	}

	log.Printf("Found %d notes to index", len(notes))

	// Index each note
	for _, note := range notes {
		if err := h.bm25.IndexNote(note); err != nil {
			log.Printf("Failed to index note %d: %v", note.ID, err)
			// Continue with other notes
		}
	}

	// Get final document count
	count, err := h.bm25.GetDocumentCount()
	if err != nil {
		log.Printf("Failed to get document count: %v", err)
	} else {
		log.Printf("BM25 index rebuild complete. Indexed %d documents", count)
	}

	return nil
}

// CalloutPlugin handles the conversion of callout divs to markdown
type CalloutPlugin struct{}

func NewCalloutPlugin() *CalloutPlugin {
	return &CalloutPlugin{}
}

func (p *CalloutPlugin) Name() string {
	return "callout"
}

func (p *CalloutPlugin) Init(conv *converter.Converter) error {
	conv.Register.RendererFor("div", converter.TagTypeBlock, p.renderCallout, converter.PriorityStandard)
	return nil
}

func (p *CalloutPlugin) renderCallout(ctx converter.Context, w converter.Writer, node *html.Node) converter.RenderStatus {
	// Check if this is a callout div
	var class string
	for _, attr := range node.Attr {
		if attr.Key == "class" {
			class = attr.Val
			break
		}
	}

	if class == "" || !strings.Contains(class, "callout") {
		return converter.RenderTryNext
	}

	// Get the callout type from data-callout attribute
	calloutType := "note" // default type
	for _, attr := range node.Attr {
		if attr.Key == "data-callout" {
			calloutType = attr.Val
			break
		}
	}

	// Create markdown callout syntax
	// Using Obsidian-style callout syntax: > [!note] content
	w.Write([]byte(fmt.Sprintf("> [!%s]\n", calloutType)))

	// Process children and format them properly
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		if child.Type == html.TextNode {
			// Handle text nodes
			text := strings.TrimSpace(child.Data)
			if text != "" {
				w.Write([]byte("> " + text + "\n"))
			}
		} else if child.Type == html.ElementNode {
			// Handle element nodes (like <p>)
			if child.Data == "p" {
				// Get the text content of the paragraph
				var content strings.Builder
				for textNode := child.FirstChild; textNode != nil; textNode = textNode.NextSibling {
					if textNode.Type == html.TextNode {
						content.WriteString(textNode.Data)
					}
				}
				text := strings.TrimSpace(content.String())
				if text != "" {
					w.Write([]byte("> " + text + "\n"))
				}
			} else {
				// For other elements, render them normally
				ctx.RenderNodes(ctx, w, child)
			}
		}
	}

	return converter.RenderSuccess
}

// unescapeLatex converts escaped LaTeX characters back to their proper form
// It preserves line breaks (\\\\ -> \\) while unescaping LaTeX commands (\\phi -> \phi)
func unescapeLatex(content string) string {
	// Use regex to replace escaped LaTeX commands
	// This handles various LaTeX command patterns while preserving line breaks

	// Pattern 1: \\ followed by letters (like \\phi, \\times, \\left, etc.)
	latexCommandRegex1 := regexp.MustCompile(`\\\\([a-zA-Z]+)`)
	content = latexCommandRegex1.ReplaceAllString(content, `\$1`)

	// Pattern 2: \\ followed by symbols (like \\{, \\}, \\[, \\], etc.)
	latexCommandRegex2 := regexp.MustCompile(`\\\\([{}[\]()])`)
	content = latexCommandRegex2.ReplaceAllString(content, `\$1`)

	// Pattern 3: \\ followed by spaces (like \\ )
	latexCommandRegex3 := regexp.MustCompile(`\\\\ `)
	content = latexCommandRegex3.ReplaceAllString(content, `\\ `)

	// Pattern 4: \\ followed by other single characters (like \\&, \\%, etc.)
	// But NOT \\ followed by another \ (which would be line breaks)
	latexCommandRegex4 := regexp.MustCompile(`\\\\([^\\\s])`)
	content = latexCommandRegex4.ReplaceAllString(content, `\$1`)

	return content
}

// BlockEquationPlugin handles the conversion of block equation divs to markdown
type BlockEquationPlugin struct{}

func NewBlockEquationPlugin() *BlockEquationPlugin {
	return &BlockEquationPlugin{}
}

func (p *BlockEquationPlugin) Name() string {
	return "block-equation"
}

func (p *BlockEquationPlugin) Init(conv *converter.Converter) error {
	conv.Register.RendererFor("div", converter.TagTypeBlock, p.renderBlockEquation, converter.PriorityStandard)
	return nil
}

func (p *BlockEquationPlugin) renderBlockEquation(ctx converter.Context, w converter.Writer, node *html.Node) converter.RenderStatus {
	// Check if this is a block equation div
	var class string
	var dataContent string
	for _, attr := range node.Attr {
		if attr.Key == "class" {
			class = attr.Val
		}
		if attr.Key == "data-content" {
			dataContent = attr.Val
		}
	}

	if class == "" || !strings.Contains(class, "block-equation") {
		return converter.RenderTryNext
	}

	// Extract the LaTeX content from data-content attribute
	if dataContent == "" {
		return converter.RenderTryNext
	}

	// Unescape LaTeX characters
	dataContent = unescapeLatex(dataContent)

	// The data-content contains the LaTeX with $$ delimiters, so we can use it directly
	// Just add some spacing around it for better markdown formatting
	w.Write([]byte("\n"))
	w.Write([]byte(dataContent))
	w.Write([]byte("\n\n"))

	return converter.RenderSuccess
}

// InlineEquationPlugin handles the conversion of inline equations to markdown
type InlineEquationPlugin struct{}

func NewInlineEquationPlugin() *InlineEquationPlugin {
	return &InlineEquationPlugin{}
}

func (p *InlineEquationPlugin) Name() string {
	return "inline-equation"
}

func (p *InlineEquationPlugin) Init(conv *converter.Converter) error {
	// Register for span elements that might contain inline equations
	conv.Register.RendererFor("span", converter.TagTypeInline, p.renderInlineEquation, converter.PriorityStandard)
	return nil
}

func (p *InlineEquationPlugin) renderInlineEquation(ctx converter.Context, w converter.Writer, node *html.Node) converter.RenderStatus {
	// Check if this is an inline equation span
	var class string
	for _, attr := range node.Attr {
		if attr.Key == "class" {
			class = attr.Val
			break
		}
	}

	if class == "" || !strings.Contains(class, "inline-equation") {
		return converter.RenderTryNext
	}

	// For inline equations, we'll let the default renderer handle the content
	// but we might need to ensure proper $ delimiters
	// For now, let the default renderer handle it
	return converter.RenderTryNext
}

// TextProcessingPlugin handles text transformations like LaTeX unescaping
type TextProcessingPlugin struct{}

func NewTextProcessingPlugin() *TextProcessingPlugin {
	return &TextProcessingPlugin{}
}

func (p *TextProcessingPlugin) Name() string {
	return "text-processing"
}

func (p *TextProcessingPlugin) Init(conv *converter.Converter) error {
	// Register for text nodes to handle LaTeX unescaping
	conv.Register.RendererFor("p", converter.TagTypeBlock, p.renderParagraph, converter.PriorityStandard)
	return nil
}

func (p *TextProcessingPlugin) renderParagraph(ctx converter.Context, w converter.Writer, node *html.Node) converter.RenderStatus {
	// Check if this paragraph contains LaTeX content
	hasLatex := false
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		if child.Type == html.TextNode && strings.Contains(child.Data, "\\") {
			hasLatex = true
			break
		}
	}

	if !hasLatex {
		return converter.RenderTryNext
	}

	// Process the paragraph content with LaTeX unescaping
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		if child.Type == html.TextNode {
			// Unescape LaTeX in text content
			unescapedText := unescapeLatex(child.Data)
			w.Write([]byte(unescapedText))
		} else {
			// For other elements, render them normally
			ctx.RenderNodes(ctx, w, child)
		}
	}

	return converter.RenderSuccess
}

// ExportNoteAsMarkdown exports a note as a markdown file for download
func (h *Handler) ExportNoteAsMarkdown(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	// Get the note from database
	note, err := h.db.GetNote(id)
	if err != nil {
		http.Error(w, "Note not found", http.StatusNotFound)
		return
	}

	// Create converter with custom plugins
	conv := converter.NewConverter(
		converter.WithPlugins(
			base.NewBasePlugin(),
			commonmark.NewCommonmarkPlugin(),
			table.NewTablePlugin(),
			NewCalloutPlugin(),
			NewBlockEquationPlugin(),
			NewInlineEquationPlugin(),
			NewTextProcessingPlugin(),
		),
	)

	// Convert HTML content to markdown
	markdown, err := conv.ConvertString(note.Content)
	if err != nil {
		log.Printf("Failed to convert note %d to markdown: %v", note.ID, err)
		http.Error(w, "Failed to convert note to markdown", http.StatusInternalServerError)
		return
	}

	// Create the markdown content with title
	fullMarkdown := fmt.Sprintf("# %s\n\n%s", note.Title, markdown)

	// Set headers for file download
	filename := fmt.Sprintf("%s.md", sanitizeFilename(note.Title))
	w.Header().Set("Content-Type", "text/markdown")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.Header().Set("Content-Length", strconv.Itoa(len(fullMarkdown)))

	// Write the markdown content
	w.Write([]byte(fullMarkdown))
}

// ExportAllNotesAsZip exports all notes as a zip file containing markdown files
func (h *Handler) ExportAllNotesAsZip(w http.ResponseWriter, r *http.Request) {
	// Get all notes from database
	notes, err := h.db.GetAllNotes()
	if err != nil {
		log.Printf("Failed to get notes for bulk export: %v", err)
		http.Error(w, "Failed to get notes", http.StatusInternalServerError)
		return
	}

	if len(notes) == 0 {
		http.Error(w, "No notes to export", http.StatusNotFound)
		return
	}

	// Create converter with custom plugins
	conv := converter.NewConverter(
		converter.WithPlugins(
			base.NewBasePlugin(),
			commonmark.NewCommonmarkPlugin(),
			table.NewTablePlugin(),
			NewCalloutPlugin(),
			NewBlockEquationPlugin(),
			NewInlineEquationPlugin(),
			NewTextProcessingPlugin(),
		),
	)

	// Create zip file in memory
	zipBuffer := new(bytes.Buffer)
	zipWriter := zip.NewWriter(zipBuffer)

	// Track failed notes for warning
	var failedNotes []string
	successfulCount := 0

	// Process each note
	for _, note := range notes {
		// Convert HTML content to markdown
		markdown, err := conv.ConvertString(note.Content)
		if err != nil {
			log.Printf("Failed to convert note %d (%s) to markdown: %v", note.ID, note.Title, err)
			failedNotes = append(failedNotes, note.Title)
			continue
		}

		// Create the markdown content with title
		fullMarkdown := fmt.Sprintf("# %s\n\n%s", note.Title, markdown)

		// Create filename with note ID to avoid conflicts
		filename := fmt.Sprintf("%s-%d.md", sanitizeFilename(note.Title), note.ID)

		// Add file to zip
		fileWriter, err := zipWriter.Create(filename)
		if err != nil {
			log.Printf("Failed to create zip entry for note %d (%s): %v", note.ID, note.Title, err)
			failedNotes = append(failedNotes, note.Title)
			continue
		}

		_, err = fileWriter.Write([]byte(fullMarkdown))
		if err != nil {
			log.Printf("Failed to write note %d (%s) to zip: %v", note.ID, note.Title, err)
			failedNotes = append(failedNotes, note.Title)
			continue
		}

		successfulCount++
	}

	// Close the zip writer
	err = zipWriter.Close()
	if err != nil {
		log.Printf("Failed to close zip file: %v", err)
		http.Error(w, "Failed to create zip file", http.StatusInternalServerError)
		return
	}

	// Get the zip content
	zipContent := zipBuffer.Bytes()

	// Create filename with current date
	dateStr := time.Now().Format("2006-01-02")
	filename := fmt.Sprintf("zendown-notes-%s.zip", dateStr)

	// Set headers for file download
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.Header().Set("Content-Length", strconv.Itoa(len(zipContent)))

	// Write the zip content
	w.Write(zipContent)

	// Log summary
	log.Printf("Bulk export completed: %d successful, %d failed", successfulCount, len(failedNotes))
	if len(failedNotes) > 0 {
		log.Printf("Failed notes: %v", failedNotes)
	}
}

// ExportNoteAsRawHTML exports a note as raw HTML for debugging
func (h *Handler) ExportNoteAsRawHTML(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	// Get the note from database
	note, err := h.db.GetNote(id)
	if err != nil {
		http.Error(w, "Note not found", http.StatusNotFound)
		return
	}

	// Create a complete HTML document with the note content
	htmlContent := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%s</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        .callout { border-left: 4px solid #3b82f6; padding: 1rem; margin: 1rem 0; background-color: #f8fafc; }
        .callout.info { border-left-color: #3b82f6; background-color: #eff6ff; }
        .callout.warning { border-left-color: #f59e0b; background-color: #fffbeb; }
        .callout.error { border-left-color: #ef4444; background-color: #fef2f2; }
        .callout.success { border-left-color: #10b981; background-color: #ecfdf5; }
        table { border-collapse: collapse; width: 100%%; margin: 1rem 0; }
        th, td { border: 1px solid #d1d5db; padding: 0.5rem; text-align: left; }
        th { background-color: #f9fafb; font-weight: 600; }
        pre { background-color: #f3f4f6; padding: 1rem; border-radius: 0.375rem; overflow-x: auto; }
        code { background-color: #f3f4f6; padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-family: 'Monaco', 'Menlo', monospace; }
    </style>
</head>
<body>
    <h1>%s</h1>
    %s
</body>
</html>`, note.Title, note.Title, note.Content)

	// Set headers for file download
	filename := fmt.Sprintf("%s.html", sanitizeFilename(note.Title))
	w.Header().Set("Content-Type", "text/html")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.Header().Set("Content-Length", strconv.Itoa(len(htmlContent)))

	// Write the HTML content
	w.Write([]byte(htmlContent))
}

// sanitizeFilename removes or replaces characters that are not safe for filenames
func sanitizeFilename(filename string) string {
	// Replace unsafe characters with underscores
	unsafe := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|"}
	result := filename
	for _, char := range unsafe {
		result = strings.ReplaceAll(result, char, "_")
	}

	// Remove leading/trailing spaces and dots
	result = strings.TrimSpace(result)
	result = strings.Trim(result, ".")

	// If the result is empty, use a default name
	if result == "" {
		result = "untitled"
	}

	return result
}
