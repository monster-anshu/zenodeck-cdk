import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfrontOrigin from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';

const STAGE = process.env.STAGE as string;
const USER_SERVICE_API_GATEWAY_ARN = process.env.USER_SERVICE_API_GATEWAY_ARN as string;
const API_DOMAIN = process.env.API_DOMAIN as string;
const API_DOMAIN_CERTIFICATE_ARN = process.env.API_DOMAIN_CERTIFICATE_ARN as string;
const CAMPAIGN_API_ORIGIN = process.env.CAMPAIGN_API_ORIGIN as string;

export class ZenodeckCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const corsRule: s3.CorsRule = {
      allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.DELETE],
      allowedOrigins: ['*'],
      allowedHeaders: ['*'],
      exposedHeaders: [],
      maxAge: 3000,
    };

    const tempBucket = new s3.Bucket(this, 'ZenodeckTempBucket', {
      autoDeleteObjects: true,
      blockPublicAccess: new s3.BlockPublicAccess({ blockPublicAcls: false, blockPublicPolicy: false }),
      bucketName: STAGE + '-zenodeck-temp',
      cors: [corsRule],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(1),
        },
      ],
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
    });

    const publicPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.AnyPrincipal()],
      actions: ['s3:GetObject'],
      resources: [tempBucket.arnForObjects('*')],
    });

    tempBucket.addToResourcePolicy(publicPolicy);

    const userBucket = new s3.Bucket(this, 'ZenodeckUserServiceBucket', {
      autoDeleteObjects: true,
      bucketName: STAGE + '-zenodeck-user-service',
      cors: [corsRule],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: new s3.BlockPublicAccess({ blockPublicAcls: false, blockPublicPolicy: false }),
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
    });

    const campaignBucket = new s3.Bucket(this, 'ZenodeckCampaignBucket', {
      autoDeleteObjects: true,
      bucketName: STAGE + '-zenodeck-campaign',
      cors: [corsRule],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: new s3.BlockPublicAccess({ blockPublicAcls: false, blockPublicPolicy: false }),
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
    });

    const cmsBucket = new s3.Bucket(this, 'MonsterAnshuCmdBucket', {
      autoDeleteObjects: true,
      bucketName: 'monster-anshu-cms',
      cors: [corsRule],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: new s3.BlockPublicAccess({ blockPublicAcls: false, blockPublicPolicy: false }),
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
    });

    const userServiceApiArnParts = USER_SERVICE_API_GATEWAY_ARN.split(':');
    const region = userServiceApiArnParts[3]; // Extract region
    const apiId = userServiceApiArnParts[5].split('/')[2]; // Extract API ID
    const userServiceApiUrl = `${apiId}.execute-api.${region}.amazonaws.com`;

    const apiDomainCerificate = certificatemanager.Certificate.fromCertificateArn(this, 'ApiDomainCetificate', API_DOMAIN_CERTIFICATE_ARN);

    // const corsPolicy = new cloudfront.ResponseHeadersPolicy(this, 'CorsPolicy', {
    //   corsBehavior: {
    //     accessControlAllowCredentials: true,
    //     accessControlAllowHeaders: ['Content-Type', 'Authorization'],
    //     accessControlAllowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
    //     accessControlAllowOrigins: ['*.himanshu-gunwant.com', 'localhost:3000'],
    //     originOverride: true,
    //     accessControlMaxAge: cdk.Duration.days(1),
    //   },
    // });

    const apiDistribution = new cloudfront.Distribution(this, 'ZenodeckApiDistribution', {
      domainNames: [API_DOMAIN],
      certificate: apiDomainCerificate,
      enableIpv6: false,
      enableLogging: false,
      httpVersion: cloudfront.HttpVersion.HTTP2,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,

      defaultBehavior: {
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        origin: new cloudfrontOrigin.HttpOrigin(CAMPAIGN_API_ORIGIN),
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
      },

      additionalBehaviors: {
        '/api/v1/user/*': {
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          origin: new cloudfrontOrigin.HttpOrigin(userServiceApiUrl, {
            originPath: `/${STAGE}`,
          }),
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
          // responseHeadersPolicy: corsPolicy,
        },
        // '/api/v1/campaign/*': {
        //   allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        //   cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        //   origin: new cloudfrontOrigin.HttpOrigin(CAMPAIGN_API_ORIGIN),
        //   originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        //   viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
        //   // responseHeadersPolicy: corsPolicy,
        // },
      },
    });
  }
}
