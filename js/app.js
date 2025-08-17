// Search Results Analyzer JavaScript - Static Version for Netlify

class SearchAnalyzer {
    constructor() {
        this.queryScores = {};
        this.queries = [];
        this.currentQuery = null;
        this.sortOrder = 'worst'; // 'worst', 'best', 'alphabetical'
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.processData();
            this.setupEventListeners();
            this.renderQueries();
            this.renderStats();
            this.showMainContent();
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError(error);
        }
    }

    async loadData() {
        try {
            console.log('Loading data from:', window.location.origin + '/data/query_scores_optimized.json');
            const response = await fetch('data/query_scores_optimized.json');
            console.log('Response status:', response.status, response.statusText);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            console.log('Response text length:', text.length);
            console.log('First 100 chars:', text.substring(0, 100));
            
            this.queryScores = JSON.parse(text);
            console.log('Successfully loaded', Object.keys(this.queryScores).length, 'queries');
        } catch (error) {
            console.error('Error loading data:', error);
            console.error('Error details:', error.message);
            throw error;
        }
    }

    processData() {
        this.queries = [];
        
        for (const [query, data] of Object.entries(this.queryScores)) {
            this.queries.push({
                query: query,
                relevance_rate: data.relevance_rate,
                avg_confidence: data.avg_confidence,
                relevant_count: data.relevant_count,
                total_results: data.total_results
            });
        }
    }

    showMainContent() {
        document.getElementById('loadingIndicator').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
    }

    showError(error = null) {
        let errorDetails = '';
        if (error) {
            errorDetails = `<br><small class="text-muted">Details: ${error.message}</small>`;
        }
        
        document.getElementById('loadingIndicator').innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Error loading data!</strong><br>
                This might be due to CORS restrictions when running locally.${errorDetails}
                <br><br>
                <div class="mt-3">
                    <button class="btn btn-primary me-2" onclick="location.reload()">
                        <i class="fas fa-refresh me-2"></i>Retry
                    </button>
                    <button class="btn btn-outline-secondary" onclick="window.open('https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS', '_blank')">
                        <i class="fas fa-question-circle me-2"></i>Learn about CORS
                    </button>
                </div>
                <div class="mt-3 small text-muted">
                    <strong>Solutions:</strong><br>
                    • Deploy to Netlify for full functionality<br>
                    • Use a proper web server instead of file:// protocol<br>
                    • Check browser console for detailed errors
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Query search
        const searchInput = document.getElementById('querySearch');
        searchInput.addEventListener('input', (e) => {
            this.filterQueries(e.target.value);
        });

        // Sort dropdown
        document.querySelectorAll('[data-sort]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.setSortOrder(e.target.dataset.sort);
            });
        });
    }

    setSortOrder(order) {
        this.sortOrder = order;
        this.renderQueries();
        
        // Update dropdown text
        const sortText = {
            'worst': 'Worst First',
            'best': 'Best First',
            'alphabetical': 'Alphabetical'
        };
        document.getElementById('sortDropdown').textContent = `Sort: ${sortText[order]}`;
    }

    getRelevanceClass(rate) {
        if (rate >= 0.9) return 'relevance-excellent';
        if (rate >= 0.7) return 'relevance-good';
        if (rate >= 0.5) return 'relevance-moderate';
        return 'relevance-poor';
    }

    getRelevanceText(rate) {
        if (rate >= 0.9) return 'Excellent';
        if (rate >= 0.7) return 'Good';
        if (rate >= 0.5) return 'Moderate';
        return 'Poor';
    }

    filterQueries(searchTerm) {
        const filtered = this.queries.filter(query => 
            query.query.toLowerCase().includes(searchTerm.toLowerCase())
        );
        this.renderQueries(filtered);
    }

    sortQueries(queries) {
        const queriesCopy = [...queries];
        
        switch (this.sortOrder) {
            case 'worst':
                return queriesCopy.sort((a, b) => a.relevance_rate - b.relevance_rate);
            case 'best':
                return queriesCopy.sort((a, b) => b.relevance_rate - a.relevance_rate);
            case 'alphabetical':
                return queriesCopy.sort((a, b) => a.query.localeCompare(b.query));
            default:
                return queriesCopy;
        }
    }

    renderQueries(queries = this.queries) {
        const container = document.getElementById('queryList');
        const sortedQueries = this.sortQueries(queries);
        
        if (sortedQueries.length === 0) {
            container.innerHTML = `
                <div class="text-center p-3 text-muted">
                    <i class="fas fa-search mb-2"></i><br>
                    No queries found
                </div>
            `;
            return;
        }

        container.innerHTML = sortedQueries.map(query => `
            <div class="query-item" data-query="${encodeURIComponent(query.query)}">
                <div class="query-text">${this.escapeHtml(query.query)}</div>
                <div class="query-stats">
                    <span>
                        <i class="fas fa-check-circle me-1"></i>
                        ${query.relevant_count}/${query.total_results} relevant
                    </span>
                    <span class="relevance-badge ${this.getRelevanceClass(query.relevance_rate)}">
                        ${(query.relevance_rate * 100).toFixed(0)}%
                    </span>
                </div>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.query-item').forEach(item => {
            item.addEventListener('click', () => {
                const queryText = decodeURIComponent(item.dataset.query);
                this.selectQuery(queryText, item);
            });
        });
    }

    selectQuery(queryText, element) {
        // Update UI to show selection
        document.querySelectorAll('.query-item').forEach(item => {
            item.classList.remove('active');
        });
        element.classList.add('active');

        // Load and display results
        this.currentQuery = queryText;
        this.loadQueryResults(queryText);
    }

    loadQueryResults(queryText) {
        const container = document.getElementById('resultsContainer');
        
        // Show loading state
        container.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3">Loading results for "${this.escapeHtml(queryText)}"...</p>
            </div>
        `;

        // Simulate brief loading delay for better UX
        setTimeout(() => {
            const data = this.queryScores[queryText];
            if (data) {
                const processedData = {
                    query: queryText,
                    relevance_rate: data.relevance_rate,
                    avg_confidence: data.avg_confidence,
                    relevant_count: data.relevant_count,
                    total_results: data.total_results,
                    results: data.results.sort((a, b) => b.score - a.score) // Sort by score descending
                };
                this.renderResults(processedData);
            } else {
                this.showResultsError('Query not found');
            }
        }, 200);
    }

    renderResults(data) {
        const container = document.getElementById('resultsContainer');
        
        const headerHtml = `
            <div class="results-header">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <h2>${this.escapeHtml(data.query)}</h2>
                    <span class="badge ${this.getRelevanceClass(data.relevance_rate)} fs-6">
                        ${this.getRelevanceText(data.relevance_rate)}
                    </span>
                </div>
                <div class="row">
                    <div class="col-md-3 col-6 mb-2">
                        <div class="stat-item">
                            <span class="stat-number">${(data.relevance_rate * 100).toFixed(1)}%</span>
                            <div class="stat-label">
                                <i class="fas fa-chart-pie me-1"></i>Relevance Rate
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6 mb-2">
                        <div class="stat-item">
                            <span class="stat-number">${data.relevant_count}</span>
                            <div class="stat-label">
                                <i class="fas fa-check me-1"></i>Relevant Results
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6 mb-2">
                        <div class="stat-item">
                            <span class="stat-number">${data.total_results}</span>
                            <div class="stat-label">
                                <i class="fas fa-list me-1"></i>Total Results
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6 mb-2">
                        <div class="stat-item">
                            <span class="stat-number">${(data.avg_confidence * 100).toFixed(1)}%</span>
                            <div class="stat-label">
                                <i class="fas fa-brain me-1"></i>Avg Confidence
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const resultsHtml = `
            <div class="mb-3">
                <h5>
                    <i class="fas fa-th-large me-2"></i>
                    Product Results (${data.results.length})
                </h5>
                <p class="text-muted small">Sorted by search score (highest first)</p>
            </div>
            <div class="results-grid">
                ${data.results.map((result, index) => this.renderProductCard(result, index)).join('')}
            </div>
        `;

        container.innerHTML = headerHtml + resultsHtml;

        // Add event listeners for expand buttons
        container.querySelectorAll('.expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleDescription(e.target);
            });
        });
    }

    renderProductCard(result, index) {
        const relevanceClass = result.is_relevant ? 'relevant' : 'not-relevant';
        const relevanceText = result.is_relevant ? 'Relevant' : 'Not Relevant';
        const relevanceIcon = result.is_relevant ? 'fa-check-circle' : 'fa-times-circle';
        
        // Fix mixed content by converting HTTP to HTTPS
        let imageUrl = result.imageUrl || 'https://via.placeholder.com/300x200?text=No+Image';
        if (imageUrl.startsWith('http://')) {
            imageUrl = imageUrl.replace('http://', 'https://');
        }
        
        return `
            <div class="product-card">
                <img src="${imageUrl}" alt="${this.escapeHtml(result.product_name)}" 
                     class="product-image" 
                     onerror="this.src='https://via.placeholder.com/300x200?text=No+Image+Available&bg=f8f9fa&color=6c757d'; console.log('Image failed to load:', '${imageUrl}');"
                     loading="lazy">
                <div class="product-info">
                    <div class="product-name" title="${this.escapeHtml(result.product_name)}">
                        ${this.escapeHtml(result.product_name)}
                    </div>
                    <div class="product-class">
                        <i class="fas fa-tag me-1"></i>
                        ${this.escapeHtml(result.product_class)}
                    </div>
                    <div class="product-score">
                        <span class="score-value">
                            <i class="fas fa-chart-line me-1"></i>
                            Score: ${result.score.toFixed(3)}
                        </span>
                        <span class="relevance-indicator ${relevanceClass}">
                            <i class="fas ${relevanceIcon} me-1"></i>
                            ${relevanceText}
                        </span>
                    </div>
                    <div class="text-muted small mb-2">
                        <i class="fas fa-sort-numeric-down me-1"></i>
                        Position: ${result.position} | 
                        <i class="fas fa-brain me-1"></i>
                        Confidence: ${(result.confidence * 100).toFixed(0)}%
                    </div>
                    <button class="expand-btn" data-index="${index}">
                        <i class="fas fa-chevron-down me-1"></i>
                        Show Details
                    </button>
                    <div class="product-description" style="display: none;">
                        ${this.renderProductDescription(result)}
                    </div>
                </div>
            </div>
        `;
    }

    renderProductDescription(result) {
        // Handle both old and new format
        if (result.product_embed_description) {
            // Old format - full description
            return this.escapeHtml(result.product_embed_description);
        } else if (result.desc_compressed) {
            // New format - compressed description
            try {
                const desc = JSON.parse(result.desc_compressed);
                return `
                    <div class="row">
                        <div class="col-md-6">
                            <strong>Product Details:</strong><br>
                            <strong>Name:</strong> ${this.escapeHtml(desc.name)}<br>
                            <strong>Class:</strong> ${this.escapeHtml(desc.class)}<br>
                            <strong>Price:</strong> ${this.escapeHtml(desc.price)}<br>
                            <strong>Brand:</strong> ${this.escapeHtml(desc.brand)}
                        </div>
                        <div class="col-md-6">
                            <strong>Description:</strong><br>
                            ${this.escapeHtml(desc.description)}
                        </div>
                    </div>
                `;
            } catch (e) {
                return `<em>Error loading product details</em>`;
            }
        } else {
            return `<em>No detailed description available</em>`;
        }
    }

    toggleDescription(button) {
        const description = button.nextElementSibling;
        const icon = button.querySelector('i');
        
        if (description.style.display === 'none') {
            description.style.display = 'block';
            button.innerHTML = '<i class="fas fa-chevron-up me-1"></i>Hide Details';
        } else {
            description.style.display = 'none';
            button.innerHTML = '<i class="fas fa-chevron-down me-1"></i>Show Details';
        }
    }

    renderStats() {
        const totalQueries = this.queries.length;
        const totalRelevant = this.queries.reduce((sum, q) => sum + q.relevant_count, 0);
        const totalResults = this.queries.reduce((sum, q) => sum + q.total_results, 0);
        const avgRelevance = this.queries.reduce((sum, q) => sum + q.relevance_rate, 0) / totalQueries;
        
        // Count queries by relevance buckets
        const perfectQueries = this.queries.filter(q => q.relevance_rate === 1.0).length;
        const goodQueries = this.queries.filter(q => q.relevance_rate >= 0.8 && q.relevance_rate < 1.0).length;
        const moderateQueries = this.queries.filter(q => q.relevance_rate >= 0.5 && q.relevance_rate < 0.8).length;
        const poorQueries = this.queries.filter(q => q.relevance_rate < 0.5).length;

        const container = document.getElementById('statsContainer');
        
        container.innerHTML = `
            <div class="stat-item mb-3">
                <span class="stat-number text-primary">${totalQueries}</span>
                <div class="stat-label">Total Queries</div>
            </div>
            <div class="stat-item mb-3">
                <span class="stat-number text-success">${(avgRelevance * 100).toFixed(1)}%</span>
                <div class="stat-label">Avg Relevance</div>
            </div>
            <hr>
            <div class="small">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>
                        <span class="relevance-badge relevance-excellent me-1"></span>
                        Perfect (100%)
                    </span>
                    <strong>${perfectQueries}</strong>
                </div>
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>
                        <span class="relevance-badge relevance-good me-1"></span>
                        Good (80-99%)
                    </span>
                    <strong>${goodQueries}</strong>
                </div>
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>
                        <span class="relevance-badge relevance-moderate me-1"></span>
                        Moderate (50-79%)
                    </span>
                    <strong>${moderateQueries}</strong>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <span>
                        <span class="relevance-badge relevance-poor me-1"></span>
                        Poor (&lt;50%)
                    </span>
                    <strong>${poorQueries}</strong>
                </div>
            </div>
            <hr>
            <div class="text-center small text-muted">
                <i class="fas fa-database me-1"></i>
                ${totalRelevant.toLocaleString()} relevant out of ${totalResults.toLocaleString()} total results
            </div>
        `;
    }

    showResultsError(message) {
        const container = document.getElementById('resultsContainer');
        container.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${this.escapeHtml(message)}
            </div>
        `;
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SearchAnalyzer();
});