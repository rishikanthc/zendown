package semware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
)

type Client struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

type UpsertRequest struct {
	ID      string `json:"id"`
	Content string `json:"content"`
}

type UpsertResponse struct {
	Message           string `json:"message"`
	DocumentID        string `json:"document_id"`
	Action            string `json:"action"`
	ChunksRegenerated bool   `json:"chunks_regenerated"`
	TotalChunks       int    `json:"total_chunks"`
}

type SimilarRequest struct {
	ID             string  `json:"id"`
	Threshold      float64 `json:"threshold,omitempty"`
	TopK           int     `json:"top_k,omitempty"`
	DistanceMetric string  `json:"distance_metric,omitempty"`
}

type SimilarResult struct {
	ID    string  `json:"id"`
	Score float64 `json:"score"`
}

type SimilarResponse struct {
	QueryID        string          `json:"query_id"`
	SimilarResults []SimilarResult `json:"similar_results"`
	Count          int             `json:"count"`
}

type SemanticRequest struct {
	QueryText      string  `json:"query_text"`
	Threshold      float64 `json:"threshold,omitempty"`
	TopK           int     `json:"top_k,omitempty"`
	DistanceMetric string  `json:"distance_metric,omitempty"`
}

type SemanticResponse struct {
	QueryText      string          `json:"query_text"`
	SimilarResults []SimilarResult `json:"similar_results"`
	Count          int             `json:"count"`
}

func NewClient() *Client {
	baseURL := os.Getenv("SEMWARE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8000"
	}

	apiKey := os.Getenv("SEMWARE_API_KEY")
	if apiKey == "" {
		apiKey = "your-secure-api-key-here" // Default fallback
	}

	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		client:  &http.Client{},
	}
}

func (c *Client) UpsertDocument(id string, content string) (*UpsertResponse, error) {
	reqBody := UpsertRequest{
		ID:      id,
		Content: content,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequest("POST", c.baseURL+"/api/documents/upsert", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("semware API returned status %d", resp.StatusCode)
	}

	var response UpsertResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

func (c *Client) DeleteDocument(id string) error {
	req, err := http.NewRequest("DELETE", c.baseURL+"/api/documents/"+id, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("semware API returned status %d", resp.StatusCode)
	}

	return nil
}

func (c *Client) GetSimilarDocuments(id string, threshold float64) (*SimilarResponse, error) {
	reqBody := SimilarRequest{
		ID:             id,
		Threshold:      threshold,
		DistanceMetric: "cosine",
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequest("POST", c.baseURL+"/api/search/similar", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("semware API returned status %d", resp.StatusCode)
	}

	var response SimilarResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

func (c *Client) SemanticSearch(queryText string, threshold float64) (*SemanticResponse, error) {
	log.Printf("SemWare: SemanticSearch called with query='%s', threshold=%f", queryText, threshold)
	log.Printf("SemWare: Using baseURL=%s", c.baseURL)

	reqBody := SemanticRequest{
		QueryText:      queryText,
		Threshold:      threshold,
		DistanceMetric: "cosine",
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	log.Printf("SemWare: Request body: %s", string(jsonBody))

	req, err := http.NewRequest("POST", c.baseURL+"/api/search/semantic", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	log.Printf("SemWare: Making request to %s", req.URL.String())

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	log.Printf("SemWare: Response status: %d", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		// Read the response body to get more details about the error
		body, _ := io.ReadAll(resp.Body)
		log.Printf("SemWare: Error response body: %s", string(body))
		return nil, fmt.Errorf("semware API returned status %d: %s", resp.StatusCode, string(body))
	}

	var response SemanticResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	log.Printf("SemWare: Successfully decoded response with %d results", len(response.SimilarResults))

	return &response, nil
}
