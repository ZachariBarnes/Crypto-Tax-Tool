#!/usr/bin/env bash
# //Update Terraform Secrets
terraform output -json | jq 'with_entries(.value |= .value)' -> secrets.json
# // Build Docker Image And deploy to AWS ECR
docker build -t vidulum-tax-app . &&
docker login -u AWS -p $(aws ecr get-login-password) https://$(aws sts get-caller-identity --query 'Account' --output text).dkr.ecr.us-east-1.amazonaws.com &&
docker tag $(docker images --format "{{.ID}}" --filter "reference=vidulum-tax-app") $(aws sts get-caller-identity --query 'Account' --output text).dkr.ecr.us-east-1.amazonaws.com/tax-app-repo:latest &&
docker push $(aws sts get-caller-identity --query 'Account' --output text).dkr.ecr.us-east-1.amazonaws.com/tax-app-repo
# // Deploy Lambda via Serverless
serverless deploy