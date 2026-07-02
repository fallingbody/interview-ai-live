import sys
import datetime


class BaseAppException(Exception):
    status_code = 500
    message = "Internal server error"

    def __init__(self, message: str = None,status_code:int=None):
        self.message=message
        self.status_code=status_code or self.status_code
        super().__init__(self.message)


class ValidationError(BaseAppException):
    def __init__(self,e):
        super().__init__(message=e,status_code=400)


class AuthenticationError(BaseAppException):
 
    def __init__(self,message:str='Authentication failed'):
        super().__init__(message=message,status_code=401)


class NotFoundError(BaseAppException):

    def __init__(self,message:str='Resource not found'):
        super().__init__(message=message,status_code=404)



class RateLimitExceededError(BaseAppException):
    def __init__(self,message:str="Rate limit exceeded"):
        super().__init__(message=message,status_code=429)


class ServiceError(BaseAppException):

    def __init__(self,message:str="Service processing error"):
        super().__init__(message=message,status_code=500)


class ApplicationError(BaseAppException):

    def __init__(self,message:str="Internal server error"):
        super().__init__(message=message,status_code=500)


def error_message_details(error,error_details:sys):
    _,_,exc_tb=error_details.exc_info()
    file_name=exc_tb.tb_frame.f_code.co_filename
    error_message="Error occured in python scripts name [{0}] line number [{1}] error message[{2}]".format (
        file_name,exc_tb.tb_lineno,str(error)
    )
    return error_message

class CustomException(Exception):
    def __init__(self,error_message,error_details:sys):
        super().__init__(error_message)
        self.error_message=error_message_details(error_message,error_details=error_details)

    def __str__(self):
        return self.error_message        