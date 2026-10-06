$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$openApiPath = Join-Path $projectRoot 'openapi.json'
$document = Get-Content -LiteralPath $openApiPath -Raw | ConvertFrom-Json

function Add-OrReplaceProperty($target, [string]$name, $value) {
  if ($target.PSObject.Properties.Name -contains $name) {
    $target.$name = $value
  } else {
    $target | Add-Member -NotePropertyName $name -NotePropertyValue $value
  }
}

$pathParameter = [pscustomobject]@{
  name = 'categoryId'
  in = 'path'
  required = $true
  schema = [pscustomobject]@{ type = 'integer'; format = 'int64' }
}

Add-OrReplaceProperty $document.paths '/festivals' ([pscustomobject]@{
  get = [pscustomobject]@{
    tags = @('product-reference-controller')
    operationId = 'getFestivals'
    responses = [pscustomobject]@{
      '200' = [pscustomobject]@{
        description = 'OK'
        content = [pscustomobject]@{
          'application/json' = [pscustomobject]@{
            schema = [pscustomobject]@{ '$ref' = '#/components/schemas/ApiResponseListFestivalOptionResponse' }
          }
        }
      }
    }
  }
})

Add-OrReplaceProperty $document.paths '/categories/{categoryId}/margin-median' ([pscustomobject]@{
  get = [pscustomobject]@{
    tags = @('product-reference-controller')
    operationId = 'getCategoryMarginMedian'
    parameters = @($pathParameter)
    responses = [pscustomobject]@{
      '200' = [pscustomobject]@{
        description = 'OK'
        content = [pscustomobject]@{
          'application/json' = [pscustomobject]@{
            schema = [pscustomobject]@{ '$ref' = '#/components/schemas/ApiResponseCategoryMarginMedianResponse' }
          }
        }
      }
    }
  }
})

Add-OrReplaceProperty $document.paths '/products/{productId}/comments-file' ([pscustomobject]@{
  get = [pscustomobject]@{
    tags = @('product-review-file-controller')
    operationId = 'getCommentsFileSummary'
    parameters = @([pscustomobject]@{
      name = 'productId'
      in = 'path'
      required = $true
      schema = [pscustomobject]@{ type = 'integer'; format = 'int64' }
    })
    responses = [pscustomobject]@{
      '200' = [pscustomobject]@{
        description = 'OK'
        content = [pscustomobject]@{
          'application/json' = [pscustomobject]@{
            schema = [pscustomobject]@{ '$ref' = '#/components/schemas/ApiResponseProductReviewSummaryResponse' }
          }
        }
      }
    }
  }
  post = [pscustomobject]@{
    tags = @('product-review-file-controller')
    operationId = 'uploadCommentsFile'
    parameters = @([pscustomobject]@{
      name = 'productId'
      in = 'path'
      required = $true
      schema = [pscustomobject]@{ type = 'integer'; format = 'int64' }
    })
    requestBody = [pscustomobject]@{
      required = $true
      content = [pscustomobject]@{
        'multipart/form-data' = [pscustomobject]@{
          schema = [pscustomobject]@{
            required = @('file')
            type = 'object'
            properties = [pscustomobject]@{
              file = [pscustomobject]@{ type = 'string'; format = 'binary' }
            }
          }
        }
      }
    }
    responses = [pscustomobject]@{
      '200' = [pscustomobject]@{
        description = 'OK'
        content = [pscustomobject]@{
          'application/json' = [pscustomobject]@{
            schema = [pscustomobject]@{ '$ref' = '#/components/schemas/ApiResponseProductReviewFileUploadResponse' }
          }
        }
      }
    }
  }
})

Add-OrReplaceProperty $document.paths '/ai/tasks/{id}' ([pscustomobject]@{
  get = [pscustomobject]@{
    tags = @('ai-task-controller')
    operationId = 'getAiTaskById'
    parameters = @([pscustomobject]@{
      name = 'id'
      in = 'path'
      required = $true
      schema = [pscustomobject]@{ type = 'integer'; format = 'int64' }
    })
    responses = [pscustomobject]@{
      '200' = [pscustomobject]@{
        description = 'OK'
        content = [pscustomobject]@{
          'application/json' = [pscustomobject]@{
            schema = [pscustomobject]@{ '$ref' = '#/components/schemas/ApiResponseAiTaskStatusResponse' }
          }
        }
      }
    }
  }
})

Add-OrReplaceProperty $document.components.schemas 'FestivalOptionResponse' ([pscustomobject]@{
  type = 'object'
  properties = [pscustomobject]@{
    festivalCode = [pscustomobject]@{ type = 'string' }
    festivalName = [pscustomobject]@{ type = 'string' }
  }
})
Add-OrReplaceProperty $document.components.schemas 'ApiResponseListFestivalOptionResponse' ([pscustomobject]@{
  type = 'object'
  properties = [pscustomobject]@{
    success = [pscustomobject]@{ type = 'boolean' }
    data = [pscustomobject]@{ type = 'array'; items = [pscustomobject]@{ '$ref' = '#/components/schemas/FestivalOptionResponse' } }
    error = [pscustomobject]@{ '$ref' = '#/components/schemas/ApiError' }
    timestamp = [pscustomobject]@{ type = 'string'; format = 'date-time' }
  }
})
Add-OrReplaceProperty $document.components.schemas 'CategoryMarginMedianResponse' ([pscustomobject]@{
  type = 'object'
  properties = [pscustomobject]@{
    categoryId = [pscustomobject]@{ type = 'integer'; format = 'int64' }
    categoryName = [pscustomobject]@{ type = 'string' }
    medianMarginRate = [pscustomobject]@{ type = 'number' }
    sampleCount = [pscustomobject]@{ type = 'integer'; format = 'int64' }
  }
})
Add-OrReplaceProperty $document.components.schemas 'ApiResponseCategoryMarginMedianResponse' ([pscustomobject]@{
  type = 'object'
  properties = [pscustomobject]@{
    success = [pscustomobject]@{ type = 'boolean' }
    data = [pscustomobject]@{ '$ref' = '#/components/schemas/CategoryMarginMedianResponse' }
    error = [pscustomobject]@{ '$ref' = '#/components/schemas/ApiError' }
    timestamp = [pscustomobject]@{ type = 'string'; format = 'date-time' }
  }
})
Add-OrReplaceProperty $document.components.schemas 'ProductReviewFileUploadResponse' ([pscustomobject]@{
  type = 'object'
  properties = [pscustomobject]@{
    fileName = [pscustomobject]@{ type = 'string' }
    acceptedRows = [pscustomobject]@{ type = 'integer'; format = 'int32' }
    insertedCount = [pscustomobject]@{ type = 'integer'; format = 'int32' }
    duplicateCount = [pscustomobject]@{ type = 'integer'; format = 'int32' }
    totalReviewCount = [pscustomobject]@{ type = 'integer'; format = 'int64' }
    lowConfidence = [pscustomobject]@{ type = 'boolean' }
  }
})
Add-OrReplaceProperty $document.components.schemas 'ProductReviewSummaryResponse' ([pscustomobject]@{
  type = 'object'
  properties = [pscustomobject]@{
    totalReviewCount = [pscustomobject]@{ type = 'integer'; format = 'int64' }
    lowConfidence = [pscustomobject]@{ type = 'boolean' }
  }
})
Add-OrReplaceProperty $document.components.schemas 'ApiResponseProductReviewSummaryResponse' ([pscustomobject]@{
  type = 'object'
  properties = [pscustomobject]@{
    success = [pscustomobject]@{ type = 'boolean' }
    data = [pscustomobject]@{ '$ref' = '#/components/schemas/ProductReviewSummaryResponse' }
    error = [pscustomobject]@{ '$ref' = '#/components/schemas/ApiError' }
    timestamp = [pscustomobject]@{ type = 'string'; format = 'date-time' }
  }
})
Add-OrReplaceProperty $document.components.schemas 'ApiResponseProductReviewFileUploadResponse' ([pscustomobject]@{
  type = 'object'
  properties = [pscustomobject]@{
    success = [pscustomobject]@{ type = 'boolean' }
    data = [pscustomobject]@{ '$ref' = '#/components/schemas/ProductReviewFileUploadResponse' }
    error = [pscustomobject]@{ '$ref' = '#/components/schemas/ApiError' }
    timestamp = [pscustomobject]@{ type = 'string'; format = 'date-time' }
  }
})
Add-OrReplaceProperty $document.components.schemas 'AiTaskStatusResponse' ([pscustomobject]@{
  type = 'object'
  properties = [pscustomobject]@{
    taskId = [pscustomobject]@{ type = 'integer'; format = 'int64' }
    taskType = [pscustomobject]@{ type = 'string' }
    status = [pscustomobject]@{ type = 'string' }
    totalCount = [pscustomobject]@{ type = 'integer'; format = 'int32' }
    successCount = [pscustomobject]@{ type = 'integer'; format = 'int32' }
    failCount = [pscustomobject]@{ type = 'integer'; format = 'int32' }
    progressPercent = [pscustomobject]@{ type = 'integer'; format = 'int32' }
    startedAt = [pscustomobject]@{ type = 'string'; format = 'date-time' }
    finishedAt = [pscustomobject]@{ type = 'string'; format = 'date-time' }
  }
})
Add-OrReplaceProperty $document.components.schemas 'ApiResponseAiTaskStatusResponse' ([pscustomobject]@{
  type = 'object'
  properties = [pscustomobject]@{
    success = [pscustomobject]@{ type = 'boolean' }
    data = [pscustomobject]@{ '$ref' = '#/components/schemas/AiTaskStatusResponse' }
    error = [pscustomobject]@{ '$ref' = '#/components/schemas/ApiError' }
    timestamp = [pscustomobject]@{ type = 'string'; format = 'date-time' }
  }
})

# TypeScript Angular 產生器會把 uniqueItems 陣列轉為 Set，Set 經 JSON.stringify
# 會變成 {}。HTTP 契約仍以 JSON Array 傳輸，唯一性由後端 Set/驗證規則保證。
$arrayPropertiesBySchema = [ordered]@{
  ProductCreateRequest = @('logisticsConditions', 'keywordIds')
  ProductUpdateRequest = @('logisticsConditions', 'keywordIds')
  ProductResponse = @('logisticsConditions', 'keywordIds')
  ProductBatchAnalyzeRequest = @('productIds')
  ProductBatchAnalyzeResponse = @('productIds')
  ProductBatchCategoryRequest = @('productIds')
  ProductBatchCategoryResponse = @('productIds')
  ProductBatchDisableRequest = @('productIds')
  ProductBatchDisableResponse = @('productIds')
}

foreach ($schemaName in $arrayPropertiesBySchema.Keys) {
  $schema = $document.components.schemas.$schemaName
  if ($null -eq $schema) { continue }
  foreach ($propertyName in $arrayPropertiesBySchema[$schemaName]) {
    $property = $schema.properties.$propertyName
    if ($null -ne $property) {
      $property.PSObject.Properties.Remove('uniqueItems')
    }
  }
}

$json = $document | ConvertTo-Json -Depth 100 -Compress
[System.IO.File]::WriteAllText($openApiPath, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
