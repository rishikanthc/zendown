package search

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"zendown/database"

	"github.com/blevesearch/bleve/v2"
)

type BM25SearchService struct {
	index bleve.Index
}

type SearchDocument struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type SearchResult struct {
	Note  *database.Note `json:"note"`
	Score float64        `json:"score"`
}

func NewBM25SearchService(indexPath string) (*BM25SearchService, error) {
	// Create the index directory if it doesn't exist
	if err := os.MkdirAll(filepath.Dir(indexPath), 0755); err != nil {
		return nil, fmt.Errorf("failed to create index directory: %w", err)
	}

	var index bleve.Index
	var err error

	// Try to open existing index
	index, err = bleve.Open(indexPath)
	if err != nil {
		// Index doesn't exist, create a new one
		log.Printf("Creating new BM25 search index at: %s", indexPath)
		index, err = createIndex(indexPath)
		if err != nil {
			return nil, fmt.Errorf("failed to create index: %w", err)
		}
	}

	return &BM25SearchService{
		index: index,
	}, nil
}

func createIndex(indexPath string) (bleve.Index, error) {
	// Create a new index mapping
	indexMapping := bleve.NewIndexMapping()

	// Configure the default analyzer
	indexMapping.DefaultAnalyzer = "standard"

	// Create a document mapping for notes
	noteMapping := bleve.NewDocumentMapping()

	// Title field - use standard analyzer for better search
	titleFieldMapping := bleve.NewTextFieldMapping()
	titleFieldMapping.Analyzer = "standard"
	titleFieldMapping.Store = true
	titleFieldMapping.Index = true
	noteMapping.AddFieldMappingsAt("title", titleFieldMapping)

	// Content field - use standard analyzer for better search
	contentFieldMapping := bleve.NewTextFieldMapping()
	contentFieldMapping.Analyzer = "standard"
	contentFieldMapping.Store = true
	contentFieldMapping.Index = true
	noteMapping.AddFieldMappingsAt("content", contentFieldMapping)

	// ID field - use keyword analyzer for exact matches
	idFieldMapping := bleve.NewTextFieldMapping()
	idFieldMapping.Analyzer = "keyword"
	idFieldMapping.Store = true
	idFieldMapping.Index = true
	noteMapping.AddFieldMappingsAt("id", idFieldMapping)

	// Date fields - use keyword analyzer
	createdAtFieldMapping := bleve.NewDateTimeFieldMapping()
	createdAtFieldMapping.Store = true
	createdAtFieldMapping.Index = true
	noteMapping.AddFieldMappingsAt("created_at", createdAtFieldMapping)

	updatedAtFieldMapping := bleve.NewDateTimeFieldMapping()
	updatedAtFieldMapping.Store = true
	updatedAtFieldMapping.Index = true
	noteMapping.AddFieldMappingsAt("updated_at", updatedAtFieldMapping)

	// Add the note mapping to the index
	indexMapping.AddDocumentMapping("note", noteMapping)

	// Create the index
	return bleve.New(indexPath, indexMapping)
}

func (s *BM25SearchService) IndexNote(note *database.Note) error {
	doc := SearchDocument{
		ID:        fmt.Sprintf("%d", note.ID),
		Title:     note.Title,
		Content:   note.Content,
		CreatedAt: note.CreatedAt,
		UpdatedAt: note.UpdatedAt,
	}

	return s.index.Index(doc.ID, doc)
}

func (s *BM25SearchService) RemoveNote(noteID int64) error {
	docID := fmt.Sprintf("%d", noteID)
	return s.index.Delete(docID)
}

func (s *BM25SearchService) Search(query string, limit int) ([]SearchResult, error) {
	if strings.TrimSpace(query) == "" {
		return []SearchResult{}, nil
	}

	// Create a search query that searches both title and content
	titleQuery := bleve.NewMatchQuery(query)
	titleQuery.SetField("title")
	titleQuery.SetBoost(2.0) // Give title matches higher weight

	contentQuery := bleve.NewMatchQuery(query)
	contentQuery.SetField("content")

	// Combine queries with OR
	searchQuery := bleve.NewDisjunctionQuery(titleQuery, contentQuery)

	// Create search request
	searchRequest := bleve.NewSearchRequest(searchQuery)
	searchRequest.Size = limit
	searchRequest.Fields = []string{"*"} // Return all fields

	// Execute search
	searchResult, err := s.index.Search(searchRequest)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	// Convert results
	var results []SearchResult
	for _, hit := range searchResult.Hits {
		noteID, err := parseNoteID(hit.ID)
		if err != nil {
			log.Printf("Failed to parse note ID from search result: %s", hit.ID)
			continue
		}

		// Extract note data from hit
		note := &database.Note{
			ID:        noteID,
			Title:     getStringField(hit.Fields, "title"),
			Content:   getStringField(hit.Fields, "content"),
			CreatedAt: getTimeField(hit.Fields, "created_at"),
			UpdatedAt: getTimeField(hit.Fields, "updated_at"),
		}

		results = append(results, SearchResult{
			Note:  note,
			Score: hit.Score,
		})
	}

	return results, nil
}

func (s *BM25SearchService) Close() error {
	return s.index.Close()
}

func (s *BM25SearchService) GetDocumentCount() (uint64, error) {
	return s.index.DocCount()
}

// Helper functions
func parseNoteID(id string) (int64, error) {
	var noteID int64
	_, err := fmt.Sscanf(id, "%d", &noteID)
	return noteID, err
}

func getStringField(fields map[string]interface{}, fieldName string) string {
	if value, exists := fields[fieldName]; exists {
		if str, ok := value.(string); ok {
			return str
		}
		// Handle array of strings (common in bleve)
		if arr, ok := value.([]interface{}); ok && len(arr) > 0 {
			if str, ok := arr[0].(string); ok {
				return str
			}
		}
	}
	return ""
}

func getTimeField(fields map[string]interface{}, fieldName string) time.Time {
	if value, exists := fields[fieldName]; exists {
		if str, ok := value.(string); ok {
			if t, err := time.Parse(time.RFC3339, str); err == nil {
				return t
			}
		}
		// Handle array of strings
		if arr, ok := value.([]interface{}); ok && len(arr) > 0 {
			if str, ok := arr[0].(string); ok {
				if t, err := time.Parse(time.RFC3339, str); err == nil {
					return t
				}
			}
		}
	}
	return time.Time{}
}
