variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project prefix used for AWS resource names"
  type        = string
  default     = "weekly-offers"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "csv_bucket_force_destroy" {
  description = "Allow destroying CSV/data buckets even when not empty"
  type        = bool
  default     = false
}

variable "site_bucket_force_destroy" {
  description = "Allow destroying site bucket even when not empty"
  type        = bool
  default     = false
}

variable "custom_domain_name" {
  description = "Optional custom domain for CloudFront (example: offers.example.com)"
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID used for DNS validation and alias record when custom_domain_name is set"
  type        = string
  default     = ""
}

variable "presign_url_expiration_seconds" {
  description = "Expiration of generated S3 presigned upload URLs"
  type        = number
  default     = 300
}
