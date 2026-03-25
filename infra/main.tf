resource "aws_s3_bucket" "csv_input" {
  bucket        = local.csv_input_bucket
  force_destroy = var.csv_bucket_force_destroy
}

resource "aws_s3_bucket_versioning" "csv_input" {
  bucket = aws_s3_bucket.csv_input.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "csv_input" {
  bucket = aws_s3_bucket.csv_input.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "processed_data" {
  bucket        = local.processed_bucket
  force_destroy = var.csv_bucket_force_destroy
}

resource "aws_s3_bucket_versioning" "processed_data" {
  bucket = aws_s3_bucket.processed_data.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "processed_data" {
  bucket = aws_s3_bucket.processed_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "catalog_site" {
  bucket        = local.catalog_site_bucket
  force_destroy = var.site_bucket_force_destroy
}

resource "aws_s3_bucket_versioning" "catalog_site" {
  bucket = aws_s3_bucket.catalog_site.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "catalog_site" {
  bucket = aws_s3_bucket.catalog_site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "archive_file" "csv_transformer_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/csv-to-json"
  output_path = "${path.module}/csv-transformer.zip"
}

data "archive_file" "presign_upload_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/presign-upload"
  output_path = "${path.module}/presign-upload.zip"
}

resource "aws_iam_role" "lambda_execution" {
  name = "${var.project_name}-${var.environment}-csv-transformer-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-${var.environment}-csv-transformer-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow",
        Action = [
          "s3:GetObject"
        ],
        Resource = [
          "${aws_s3_bucket.csv_input.arn}/*"
        ]
      },
      {
        Effect = "Allow",
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ],
        Resource = [
          "${aws_s3_bucket.processed_data.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_lambda_function" "csv_transformer" {
  function_name = "${var.project_name}-${var.environment}-csv-transformer"
  role          = aws_iam_role.lambda_execution.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  timeout       = 60
  memory_size   = 256

  filename         = data.archive_file.csv_transformer_zip.output_path
  source_code_hash = data.archive_file.csv_transformer_zip.output_base64sha256

  environment {
    variables = {
      PROCESSED_BUCKET = aws_s3_bucket.processed_data.bucket
      OUTPUT_PREFIX    = "data/processed"
      CATALOG_KEY      = "data/catalog/index.json"
    }
  }
}

resource "aws_iam_role" "presign_lambda_execution" {
  name = "${var.project_name}-${var.environment}-presign-upload-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "presign_lambda_policy" {
  name = "${var.project_name}-${var.environment}-presign-upload-policy"
  role = aws_iam_role.presign_lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow",
        Action = [
          "s3:PutObject"
        ],
        Resource = [
          "${aws_s3_bucket.csv_input.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_lambda_function" "presign_upload" {
  function_name = "${var.project_name}-${var.environment}-presign-upload"
  role          = aws_iam_role.presign_lambda_execution.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  timeout       = 15
  memory_size   = 128

  filename         = data.archive_file.presign_upload_zip.output_path
  source_code_hash = data.archive_file.presign_upload_zip.output_base64sha256

  environment {
    variables = {
      UPLOAD_BUCKET           = aws_s3_bucket.csv_input.bucket
      UPLOAD_PREFIX           = "uploads"
      URL_EXPIRATION_SECONDS  = tostring(var.presign_url_expiration_seconds)
    }
  }
}

resource "aws_lambda_function_url" "presign_upload" {
  function_name      = aws_lambda_function.presign_upload.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = false
    allow_methods     = ["GET"]
    allow_origins     = ["*"]
    allow_headers     = ["content-type"]
    max_age           = 86400
  }
}

resource "aws_lambda_permission" "allow_s3_invoke" {
  statement_id  = "AllowExecutionFromS3"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.csv_transformer.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.csv_input.arn
}

resource "aws_s3_bucket_notification" "csv_uploaded" {
  bucket = aws_s3_bucket.csv_input.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.csv_transformer.arn
    events              = ["s3:ObjectCreated:*"]
    filter_suffix       = ".csv"
  }

  depends_on = [aws_lambda_permission.allow_s3_invoke]
}

resource "aws_cloudfront_origin_access_control" "catalog_oac" {
  name                              = "${var.project_name}-${var.environment}-oac"
  description                       = "OAC for catalog and data buckets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "catalog" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = local.enable_custom_domain ? [var.custom_domain_name] : []

  origin {
    domain_name              = aws_s3_bucket.catalog_site.bucket_regional_domain_name
    origin_id                = "site-origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.catalog_oac.id
  }

  origin {
    domain_name              = aws_s3_bucket.processed_data.bucket_regional_domain_name
    origin_id                = "data-origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.catalog_oac.id
  }

  default_cache_behavior {
    target_origin_id       = "site-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  ordered_cache_behavior {
    path_pattern           = "data/*"
    target_origin_id       = "data-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn            = local.enable_custom_domain ? aws_acm_certificate_validation.catalog[0].certificate_arn : null
    cloudfront_default_certificate = local.enable_custom_domain ? false : true
    minimum_protocol_version       = local.enable_custom_domain ? "TLSv1.2_2021" : null
    ssl_support_method             = local.enable_custom_domain ? "sni-only" : null
  }
}

resource "aws_acm_certificate" "catalog" {
  count             = local.enable_custom_domain ? 1 : 0
  provider          = aws.us_east_1
  domain_name       = var.custom_domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "catalog_cert_validation" {
  for_each = local.enable_custom_domain ? {
    for dvo in aws_acm_certificate.catalog[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id = var.route53_zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "catalog" {
  count                   = local.enable_custom_domain ? 1 : 0
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.catalog[0].arn
  validation_record_fqdns = [for record in aws_route53_record.catalog_cert_validation : record.fqdn]
}

resource "aws_route53_record" "catalog_alias_a" {
  count   = local.enable_custom_domain ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.custom_domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.catalog.domain_name
    zone_id                = aws_cloudfront_distribution.catalog.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "catalog_alias_aaaa" {
  count   = local.enable_custom_domain ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.custom_domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.catalog.domain_name
    zone_id                = aws_cloudfront_distribution.catalog.hosted_zone_id
    evaluate_target_health = false
  }
}

data "aws_iam_policy_document" "catalog_site_bucket_policy" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.catalog_site.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.catalog.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "catalog_site" {
  bucket = aws_s3_bucket.catalog_site.id
  policy = data.aws_iam_policy_document.catalog_site_bucket_policy.json
}

data "aws_iam_policy_document" "processed_data_bucket_policy" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.processed_data.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.catalog.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "processed_data" {
  bucket = aws_s3_bucket.processed_data.id
  policy = data.aws_iam_policy_document.processed_data_bucket_policy.json
}
