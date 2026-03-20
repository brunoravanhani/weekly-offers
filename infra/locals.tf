data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

locals {
  base_name           = "${var.project_name}-${var.environment}-${data.aws_region.current.name}-${data.aws_caller_identity.current.account_id}"
  csv_input_bucket    = "${local.base_name}-csv-input"
  processed_bucket    = "${local.base_name}-processed"
  catalog_site_bucket = "${local.base_name}-site"
  enable_custom_domain = trim(var.custom_domain_name) != "" && trim(var.route53_zone_id) != ""
}
