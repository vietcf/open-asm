# Copyright 2025 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.  
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at  
# http://aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_organizations_organization" "org" {}

data "aws_organizations_organizational_units" "root" {
  parent_id = data.aws_organizations_organization.org.roots[0].id
}

data "aws_ssm_parameter" "lz_production_vcb_production_s3_gd_findings_arn" {
  provider = aws.lz_platform
  count  = var.deploy_gd_finding_export == true ? 1 : 0
  name     = "/${var.landingzone_prefix}/${var.master_prefix}/logarchive/${var.env_prefix}/centralized-logging/guarduty-finding-log-arn"
}