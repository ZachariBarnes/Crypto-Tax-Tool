resource "aws_vpc" "vpc" {
    cidr_block = "10.0.0.0/24"
    enable_dns_support   = true
    enable_dns_hostnames = true
    tags       = {
        Name = "Terraform VPC"
    }
}

resource "aws_internet_gateway" "internet_gateway" {
    vpc_id = aws_vpc.vpc.id
}

resource "aws_subnet" "pub_subnet" {
    vpc_id                  = aws_vpc.vpc.id
    cidr_block              = "10.0.0.0/24"
}

resource "aws_route_table" "public" {
    vpc_id = aws_vpc.vpc.id

    route {
        cidr_block = "0.0.0.0/0"
        gateway_id = aws_internet_gateway.internet_gateway.id
    }
}

resource "aws_route_table_association" "route_table_association" {
    subnet_id      = aws_subnet.pub_subnet.id
    route_table_id = aws_route_table.public.id
}

# resource "aws_vpc_endpoint_route_table_association" "example" {
#   route_table_id  = aws_route_table.example.id
#   vpc_endpoint_id = aws_vpc_endpoint.example.id
# }

resource "aws_security_group" "ecs_sg" {
    vpc_id      = aws_vpc.vpc.id

    ingress {
        from_port       = 22
        to_port         = 22
        protocol        = "tcp"
        cidr_blocks     = ["0.0.0.0/0"]
    }

    ingress {
        from_port       = 443
        to_port         = 443
        protocol        = "tcp"
        cidr_blocks     = ["0.0.0.0/0"]
    }

    ingress {
        cidr_blocks      = ["0.0.0.0/0"]
        description      = ""
        from_port        = 0
        ipv6_cidr_blocks = []
        prefix_list_ids  = []
        protocol         = "-1"
        security_groups  = []
        self             = false
        to_port          = 0
    }

    egress {
        from_port       = 8080
        to_port         = 8080
        protocol        = "tcp"
        cidr_blocks     = ["0.0.0.0/0"]
    }

    egress {
        cidr_blocks      = ["0.0.0.0/0"]
        description      = ""
        from_port        = 0
        ipv6_cidr_blocks = []
        prefix_list_ids  = []
        protocol         = "-1"
        security_groups  = []
        self             = false
        to_port          = 0
    }

    ingress {
        cidr_blocks      = ["24.216.209.207/32"]
        description      = ""
        from_port        = 8080
        ipv6_cidr_blocks = []
        prefix_list_ids  = []
        protocol         = "tcp"
        security_groups  = []
        self             = false
        to_port          = 8080
    }

    # ingress {
    #     cidr_blocks      = ["0.0.0.0/0"]
    #     description      = ""
    #     from_port        = 22
    #     ipv6_cidr_blocks = []
    #     prefix_list_ids  = []
    #     protocol         = "tcp"
    #     security_groups  = []
    #     self             = false
    #     to_port          = 22
    # }
    # ingress {
    #     cidr_blocks      = ["0.0.0.0/0"]
    #     description      = ""
    #     from_port        = 443
    #     ipv6_cidr_blocks = []
    #     prefix_list_ids  = []
    #     protocol         = "tcp"
    #     security_groups  = []
    #     self             = false
    #     to_port          = 443
    # }
}
/* 
resource "aws_vpc_endpoint" "ecr_api" {
    vpc_id              = aws_vpc.vpc.id
    service_name        = "com.amazonaws.us-east-1.ecr.api"
    vpc_endpoint_type   = "Interface"
    security_group_ids  = [
        aws_security_group.ecs_sg.id,
        "sg-0978d08527b0577b2"
    ]
    private_dns_enabled = true
}*/

/* resource "aws_vpc_endpoint" "ecr_dkr" {
    vpc_id              = aws_vpc.vpc.id
    service_name        = "com.amazonaws.us-east-1.ecr.dkr"
    vpc_endpoint_type   = "Interface"
    security_group_ids  = [
        aws_security_group.ecs_sg.id,
        "sg-0978d08527b0577b2"
    ]
    private_dns_enabled = true
} */

resource "aws_vpc_endpoint" "dynamodb" {
    vpc_id              = aws_vpc.vpc.id
    service_name        = "com.amazonaws.us-east-1.dynamodb"
    vpc_endpoint_type   = "Gateway"
    private_dns_enabled = false
}

resource "aws_vpc_endpoint_route_table_association" "dynamodb_endpoint_pub_route" {
  route_table_id  = aws_route_table.public.id
  vpc_endpoint_id = aws_vpc_endpoint.dynamodb.id
}

resource "aws_network_interface" "event_interface" {
  subnet_id       = aws_subnet.pub_subnet.id
  private_ips     = ["10.0.0.124"]
  security_groups = [aws_security_group.ecs_sg.id]
}

resource "aws_vpc_endpoint" "events" {
    vpc_id                = aws_vpc.vpc.id
    service_name          = "com.amazonaws.us-east-1.events"
    vpc_endpoint_type     = "Interface"
    security_group_ids    = [
        aws_security_group.ecs_sg.id
    ]
    subnet_ids            = [aws_subnet.pub_subnet.id]

//   network_interface_ids = [
//        "eni-0a438e95aa2f55d94"
//    ] 
    private_dns_enabled   = true
} 

