"use strict";
// Quote Post Collection Module
// Handles detection, extraction, and tracking of quote posts and quote chains
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotePostCollector = void 0;
exports.isQuotePost = isQuotePost;
exports.extractQuotedPostUri = extractQuotedPostUri;
var supabase_js_1 = require("@supabase/supabase-js");
var QuotePostCollector = /** @class */ (function () {
    function QuotePostCollector(supabaseUrl, supabaseKey) {
        this.quoteChainCache = new Map();
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    }
    /**
     * Detect if a post is a quote post from Bluesky API response
     */
    QuotePostCollector.prototype.detectQuotePost = function (postRecord, postEmbed) {
        var _a;
        var result = {
            postUri: '',
            isQuotePost: false,
            quoteDepth: 0,
        };
        // Check for quote post embed types
        if (!(postRecord === null || postRecord === void 0 ? void 0 : postRecord.embed)) {
            return result;
        }
        var embedType = postRecord.embed.$type;
        // Basic quote post (app.bsky.embed.record)
        if (embedType === 'app.bsky.embed.record') {
            result.isQuotePost = true;
            result.quotedPostUri = postRecord.embed.record.uri;
            result.quotedPostCid = postRecord.embed.record.cid;
            // Extract quoted post data if available
            if (postEmbed === null || postEmbed === void 0 ? void 0 : postEmbed.record) {
                this.extractQuotedPostData(result, postEmbed.record);
            }
        }
        // Quote post with media (app.bsky.embed.recordWithMedia)
        else if (embedType === 'app.bsky.embed.recordWithMedia') {
            result.isQuotePost = true;
            result.quotedPostUri = postRecord.embed.record.record.uri;
            result.quotedPostCid = postRecord.embed.record.record.cid;
            // Extract quoted post data if available
            if ((_a = postEmbed === null || postEmbed === void 0 ? void 0 : postEmbed.record) === null || _a === void 0 ? void 0 : _a.record) {
                this.extractQuotedPostData(result, postEmbed.record.record);
            }
        }
        return result;
    };
    /**
     * Extract data from the quoted post embed
     */
    QuotePostCollector.prototype.extractQuotedPostData = function (result, quotedPostEmbed) {
        var _a, _b, _c, _d;
        if (!quotedPostEmbed)
            return;
        result.quotedAuthorDid = (_a = quotedPostEmbed.author) === null || _a === void 0 ? void 0 : _a.did;
        result.quotedPostData = {
            text: (_b = quotedPostEmbed.record) === null || _b === void 0 ? void 0 : _b.text,
            author: {
                did: ((_c = quotedPostEmbed.author) === null || _c === void 0 ? void 0 : _c.did) || '',
                handle: ((_d = quotedPostEmbed.author) === null || _d === void 0 ? void 0 : _d.handle) || '',
            },
            likeCount: quotedPostEmbed.likeCount || 0,
            repostCount: quotedPostEmbed.repostCount || 0,
            replyCount: quotedPostEmbed.replyCount || 0,
        };
    };
    /**
     * Analyze quote chain depth and relationships
     */
    QuotePostCollector.prototype.analyzeQuoteChain = function (quoteData) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cached, quotedPost, chainInfo;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!quoteData.isQuotePost || !quoteData.quotedPostUri) {
                            return [2 /*return*/, { rootUri: quoteData.postUri, depth: 0 }];
                        }
                        cacheKey = quoteData.quotedPostUri;
                        if (this.quoteChainCache.has(cacheKey)) {
                            cached = this.quoteChainCache.get(cacheKey);
                            return [2 /*return*/, {
                                    rootUri: cached.rootUri,
                                    depth: cached.depth + 1,
                                    parentQuoteUri: quoteData.quotedPostUri,
                                }];
                        }
                        return [4 /*yield*/, this.supabase
                                .from('bluesky_posts')
                                .select('uri, is_quote_post, quoted_post_uri, quote_depth, quote_chain_root')
                                .eq('uri', quoteData.quotedPostUri)
                                .maybeSingle()];
                    case 1:
                        quotedPost = (_a.sent()).data;
                        if (quotedPost) {
                            if (quotedPost.is_quote_post && quotedPost.quote_chain_root) {
                                // This is a nested quote - inherit from the chain
                                chainInfo = {
                                    rootUri: quotedPost.quote_chain_root,
                                    depth: (quotedPost.quote_depth || 0) + 1,
                                    parentQuoteUri: quoteData.quotedPostUri,
                                };
                            }
                            else {
                                // This is a direct quote of a regular post
                                chainInfo = {
                                    rootUri: quotedPost.uri,
                                    depth: 1,
                                    parentQuoteUri: quoteData.quotedPostUri,
                                };
                            }
                        }
                        else {
                            // Quoted post not in database yet - assume it's the root
                            chainInfo = {
                                rootUri: quoteData.quotedPostUri,
                                depth: 1,
                                parentQuoteUri: quoteData.quotedPostUri,
                            };
                        }
                        // Cache the result
                        this.quoteChainCache.set(cacheKey, {
                            rootUri: chainInfo.rootUri,
                            depth: chainInfo.depth - 1, // Cache the depth of the quoted post
                        });
                        return [2 /*return*/, chainInfo];
                }
            });
        });
    };
    /**
     * Store quote post data in database
     */
    QuotePostCollector.prototype.storeQuotePost = function (postUri, authorDid, createdAt, quoteData, chainInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var promises, results, errors;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        promises = [];
                        // Update the post record with quote information
                        if (quoteData.isQuotePost) {
                            promises.push(this.supabase
                                .from('bluesky_posts')
                                .update({
                                is_quote_post: true,
                                quoted_post_uri: quoteData.quotedPostUri,
                                quoted_post_cid: quoteData.quotedPostCid,
                                quoted_author_did: quoteData.quotedAuthorDid,
                                quote_depth: chainInfo.depth,
                                quote_chain_root: chainInfo.rootUri,
                            })
                                .eq('uri', postUri));
                            // Insert quote relationship
                            promises.push(this.supabase
                                .from('bluesky_quote_relationships')
                                .upsert({
                                quote_post_uri: postUri,
                                quoted_post_uri: quoteData.quotedPostUri,
                                quote_author_did: authorDid,
                                quoted_author_did: quoteData.quotedAuthorDid,
                                quote_depth: chainInfo.depth,
                                quote_chain_root: chainInfo.rootUri,
                                created_at: createdAt,
                            }, {
                                onConflict: 'quote_post_uri,quoted_post_uri'
                            }));
                            // Store quote engagement data if available
                            if (quoteData.quotedPostData) {
                                promises.push(this.supabase
                                    .from('bluesky_quote_engagement')
                                    .upsert({
                                    quote_post_uri: postUri,
                                    quoted_post_uri: quoteData.quotedPostUri,
                                    original_likes: quoteData.quotedPostData.likeCount || 0,
                                    original_reposts: quoteData.quotedPostData.repostCount || 0,
                                    original_replies: quoteData.quotedPostData.replyCount || 0,
                                }, {
                                    onConflict: 'quote_post_uri'
                                }));
                            }
                        }
                        return [4 /*yield*/, Promise.allSettled(promises)];
                    case 1:
                        results = _a.sent();
                        errors = results
                            .filter(function (result) { return result.status === 'rejected'; })
                            .map(function (result) { return result.reason; });
                        if (errors.length > 0) {
                            console.error('Quote post storage errors:', errors);
                            throw new Error("Failed to store quote post data: ".concat(errors[0]));
                        }
                        if (!(quoteData.isQuotePost && chainInfo.rootUri)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.updateQuoteChainStats(chainInfo.rootUri)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update quote chain statistics
     */
    QuotePostCollector.prototype.updateQuoteChainStats = function (rootUri) {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.supabase.rpc('update_quote_chain_stats', { root_uri: rootUri })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        console.error('Failed to update quote chain stats:', error_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Process a batch of posts for quote detection and storage
     */
    QuotePostCollector.prototype.processBatch = function (posts) {
        return __awaiter(this, void 0, void 0, function () {
            var quotePostsToProcess, _i, posts_1, post, quoteData, chainInfo, _a, quotePostsToProcess_1, item, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        quotePostsToProcess = [];
                        _i = 0, posts_1 = posts;
                        _b.label = 1;
                    case 1:
                        if (!(_i < posts_1.length)) return [3 /*break*/, 4];
                        post = posts_1[_i];
                        quoteData = this.detectQuotePost(post.record, post.embed);
                        quoteData.postUri = post.uri;
                        if (!quoteData.isQuotePost) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.analyzeQuoteChain(quoteData)];
                    case 2:
                        chainInfo = _b.sent();
                        quotePostsToProcess.push({
                            postUri: post.uri,
                            authorDid: post.authorDid,
                            createdAt: post.createdAt,
                            quoteData: quoteData,
                            chainInfo: chainInfo,
                        });
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        _a = 0, quotePostsToProcess_1 = quotePostsToProcess;
                        _b.label = 5;
                    case 5:
                        if (!(_a < quotePostsToProcess_1.length)) return [3 /*break*/, 10];
                        item = quotePostsToProcess_1[_a];
                        _b.label = 6;
                    case 6:
                        _b.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, this.storeQuotePost(item.postUri, item.authorDid, item.createdAt, item.quoteData, item.chainInfo)];
                    case 7:
                        _b.sent();
                        return [3 /*break*/, 9];
                    case 8:
                        error_2 = _b.sent();
                        console.error("Failed to store quote post ".concat(item.postUri, ":"), error_2);
                        return [3 /*break*/, 9];
                    case 9:
                        _a++;
                        return [3 /*break*/, 5];
                    case 10: return [2 /*return*/, {
                            totalProcessed: posts.length,
                            quotePosts: quotePostsToProcess.length,
                        }];
                }
            });
        });
    };
    /**
     * Get quote chain analytics
     */
    QuotePostCollector.prototype.getQuoteChainAnalytics = function (rootUri) {
        return __awaiter(this, void 0, void 0, function () {
            var query, _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        query = this.supabase
                            .from('quote_post_analytics')
                            .select('*')
                            .order('total_quotes', { ascending: false });
                        if (rootUri) {
                            query = query.eq('quote_chain_root', rootUri);
                        }
                        return [4 /*yield*/, query.limit(100)];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            throw new Error("Failed to get quote chain analytics: ".concat(error.message));
                        }
                        return [2 /*return*/, data || []];
                }
            });
        });
    };
    /**
     * Clear cache (useful for long-running processes)
     */
    QuotePostCollector.prototype.clearCache = function () {
        this.quoteChainCache.clear();
    };
    return QuotePostCollector;
}());
exports.QuotePostCollector = QuotePostCollector;
// Utility functions
function isQuotePost(postRecord) {
    var _a, _b;
    return ((_a = postRecord === null || postRecord === void 0 ? void 0 : postRecord.embed) === null || _a === void 0 ? void 0 : _a.$type) === 'app.bsky.embed.record' ||
        ((_b = postRecord === null || postRecord === void 0 ? void 0 : postRecord.embed) === null || _b === void 0 ? void 0 : _b.$type) === 'app.bsky.embed.recordWithMedia';
}
function extractQuotedPostUri(postRecord) {
    if (!isQuotePost(postRecord))
        return null;
    if (postRecord.embed.$type === 'app.bsky.embed.record') {
        return postRecord.embed.record.uri;
    }
    if (postRecord.embed.$type === 'app.bsky.embed.recordWithMedia') {
        return postRecord.embed.record.record.uri;
    }
    return null;
}
